import type Stripe from "stripe";

import { config } from "../config.ts";
import { stripeClient } from "../lib/stripe.ts";
import type { StripeGateway } from "../types/dependencies.ts";
import { HttpError } from "../utils/httpError.ts";

export class StripeService implements StripeGateway {
  async createCustomer(email: string, userId: string): Promise<string> {
    const customer = await stripeClient.customers.create(
      {
        email,
        metadata: { demoUserId: userId },
      },
      { idempotencyKey: `foodfinder-customer-${userId}` },
    );
    return customer.id;
  }

  async createCheckoutSession(customerId: string, userId: string): Promise<string> {
    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: config.stripePriceId, quantity: 1 }],
      subscription_data: { metadata: { demoUserId: userId } },
      success_url: `${config.appUrl}/checkout/success`,
      cancel_url: `${config.appUrl}/?checkout=canceled`,
    });

    if (!session.url) {
      throw new HttpError(502, "CHECKOUT_CREATION_FAILED", "Stripe did not return a checkout URL.");
    }
    return session.url;
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const event = stripeClient.webhooks.constructEvent(
      payload,
      signature,
      config.stripeWebhookSecret,
    );
    const expectsLiveEvents = /^(sk|rk)_live_/.test(config.stripeSecretKey);
    if (event.livemode !== expectsLiveEvents) {
      throw new Error("Stripe webhook mode does not match the configured API key.");
    }
    return event;
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return stripeClient.subscriptions.retrieve(subscriptionId);
  }

  hasPremiumPrice(subscription: Stripe.Subscription): boolean {
    return subscription.items.data.some((item) => item.price.id === config.stripePriceId);
  }
}
