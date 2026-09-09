import type Stripe from "stripe";

import type { AppDependencies, DemoUser } from "../types/dependencies.ts";
import { HttpError } from "../utils/httpError.ts";
import { hasPremiumAccess } from "../utils/premiumAccess.ts";

const idFromExpandable = (value: string | { id: string }): string =>
  typeof value === "string" ? value : value.id;

const subscriptionPeriodEnd = (subscription: Stripe.Subscription): Date | null => {
  const timestamps = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value));
  return timestamps.length ? new Date(Math.max(...timestamps) * 1_000) : null;
};

export class SubscriptionService {
  constructor(private readonly dependencies: Pick<AppDependencies, "store" | "stripe">) {}

  async status() {
    const user = await this.dependencies.store.getDemoUser();
    return {
      isActive: hasPremiumAccess(user.subscription?.status),
      status: user.subscription?.status ?? null,
      currentPeriodEnd: user.subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd ?? false,
    };
  }

  async createCheckout() {
    const user = await this.dependencies.store.getDemoUser();
    if (hasPremiumAccess(user.subscription?.status)) {
      throw new HttpError(409, "SUBSCRIPTION_ALREADY_ACTIVE", "Premium is already active.");
    }
    const customerId = await this.ensureStripeCustomer(user);
    return this.dependencies.stripe.createCheckoutSession(customerId, user.id);
  }

  private async ensureStripeCustomer(user: DemoUser): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customerId = await this.dependencies.stripe.createCustomer(user.email, user.id);
    await this.dependencies.store.updateStripeCustomer(user.id, customerId);
    return customerId;
  }

  async processEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
    if (await this.dependencies.store.hasProcessedStripeEvent(event.id)) return "duplicate";

    let recognized = false;
    let handled = false;
    if (event.type === "checkout.session.completed") {
      recognized = true;
      handled = await this.handleCheckoutCompleted(event.data.object);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      recognized = true;
      // Stripe does not guarantee event delivery order. Reading the latest object
      // prevents an older event snapshot from restoring stale access.
      const subscription = await this.dependencies.stripe.retrieveSubscription(
        event.data.object.id,
      );
      handled = await this.syncSubscription(subscription);
    }

    if (recognized) await this.dependencies.store.recordStripeEvent(event.id, event.type);
    return handled ? "processed" : "ignored";
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<boolean> {
    const demoUser = await this.dependencies.store.getDemoUser();
    const userId = session.client_reference_id ?? session.metadata?.demoUserId;
    const customerId = session.customer ? idFromExpandable(session.customer) : null;
    if (userId && userId !== demoUser.id) {
      throw new HttpError(400, "STRIPE_USER_NOT_FOUND", "No demo user matches this checkout.");
    }
    if (customerId) {
      await this.dependencies.store.updateStripeCustomer(demoUser.id, customerId);
    }

    if (session.subscription) {
      const subscriptionId = idFromExpandable(session.subscription);
      const subscription = await this.dependencies.stripe.retrieveSubscription(subscriptionId);
      return this.syncSubscription(subscription, demoUser.id);
    }
    return customerId !== null;
  }

  private async syncSubscription(
    subscription: Stripe.Subscription,
    fallbackUserId?: string,
  ): Promise<boolean> {
    if (!this.dependencies.stripe.hasPremiumPrice(subscription)) return false;

    const customerId = idFromExpandable(subscription.customer);
    const user = await this.dependencies.store.findUserByStripeCustomerId(customerId);
    const demoUser = await this.dependencies.store.getDemoUser();
    const metadataUserId = subscription.metadata.demoUserId;
    const fallbackMatchesDemoUser =
      metadataUserId === demoUser.id || fallbackUserId === demoUser.id;
    const userId = user?.id ?? (fallbackMatchesDemoUser ? demoUser.id : undefined);

    if (!userId) {
      throw new HttpError(400, "STRIPE_USER_NOT_FOUND", "No demo user matches this subscription.");
    }
    if (userId !== demoUser.id) {
      throw new HttpError(400, "STRIPE_USER_NOT_FOUND", "No demo user matches this subscription.");
    }

    if (!user) {
      await this.dependencies.store.updateStripeCustomer(demoUser.id, customerId);
    }

    await this.dependencies.store.upsertSubscription({
      userId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
    return true;
  }
}
