import type Stripe from "stripe";

import type {
  AppDependencies,
  DataStore,
  DemoUser,
  ProductProvider,
  RecentSearch,
  StripeGateway,
  SubscriptionUpdate,
} from "../../src/types/dependencies.ts";
import type { OpenFoodFactsProduct, SupportedLanguage } from "../../src/types/product.ts";

export class FakeStore implements DataStore {
  user: DemoUser = {
    id: "demo-user",
    email: "demo@example.com",
    stripeCustomerId: "cus_demo",
    subscription: null,
  };

  savedSearches: Array<{ userId: string; query: string; language: SupportedLanguage }> = [];
  recentSearches: RecentSearch[] = [];
  subscriptionUpdates: SubscriptionUpdate[] = [];
  processedEvents = new Set<string>();
  lastRecentLimit: number | null = null;

  async getDemoUser() {
    return this.user;
  }

  async saveSearch(userId: string, query: string, language: SupportedLanguage) {
    this.savedSearches.push({ userId, query, language });
  }

  async getRecentSearches(_userId: string, limit: number) {
    this.lastRecentLimit = limit;
    return this.recentSearches.slice(0, limit);
  }

  async updateStripeCustomer(_userId: string, stripeCustomerId: string) {
    this.user.stripeCustomerId = stripeCustomerId;
  }

  async findUserByStripeCustomerId(stripeCustomerId: string) {
    return this.user.stripeCustomerId === stripeCustomerId ? { id: this.user.id } : null;
  }

  async upsertSubscription(update: SubscriptionUpdate) {
    this.subscriptionUpdates.push(update);
    this.user.subscription = {
      status: update.status,
      currentPeriodEnd: update.currentPeriodEnd,
      cancelAtPeriodEnd: update.cancelAtPeriodEnd,
    };
  }

  async hasProcessedStripeEvent(eventId: string) {
    return this.processedEvents.has(eventId);
  }

  async recordStripeEvent(eventId: string) {
    this.processedEvents.add(eventId);
  }
}

export class FakeProductProvider implements ProductProvider {
  products: OpenFoodFactsProduct[] = [];
  calls: Array<{ query: string; language: SupportedLanguage }> = [];

  async search(query: string, language: SupportedLanguage) {
    this.calls.push({ query, language });
    return this.products;
  }
}

export class FakeStripe implements StripeGateway {
  webhookEvent: Stripe.Event | null = null;
  rejectSignature = false;
  retrievedSubscription: Stripe.Subscription | null = null;
  premiumPrice = true;
  checkoutCalls = 0;

  async createCustomer() {
    return "cus_created";
  }

  async createCheckoutSession() {
    this.checkoutCalls += 1;
    return "https://checkout.stripe.test/session";
  }

  constructWebhookEvent() {
    if (this.rejectSignature || !this.webhookEvent) throw new Error("Invalid signature");
    return this.webhookEvent;
  }

  async retrieveSubscription() {
    if (this.retrievedSubscription) return this.retrievedSubscription;
    const object = this.webhookEvent?.data.object;
    if (object && "object" in object && object.object === "subscription") {
      return object;
    }
    throw new Error("No subscription fixture");
  }

  hasPremiumPrice() {
    return this.premiumPrice;
  }
}

export const makeDependencies = (): AppDependencies & {
  store: FakeStore;
  productProvider: FakeProductProvider;
  stripe: FakeStripe;
} => ({
  store: new FakeStore(),
  productProvider: new FakeProductProvider(),
  stripe: new FakeStripe(),
});

export const makeSubscription = (
  status: Stripe.Subscription.Status,
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription =>
  ({
    id: "sub_demo",
    object: "subscription",
    status,
    customer: "cus_demo",
    cancel_at_period_end: false,
    metadata: { demoUserId: "demo-user" },
    items: {
      object: "list",
      data: [{ current_period_end: 1_800_000_000 }],
      has_more: false,
      url: "/v1/subscription_items",
    },
    ...overrides,
  }) as unknown as Stripe.Subscription;

export const makeEvent = (type: Stripe.Event.Type, object: object, id = "evt_demo"): Stripe.Event =>
  ({
    id,
    object: "event",
    api_version: "2025-12-15.clover",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
    data: { object },
  }) as unknown as Stripe.Event;
