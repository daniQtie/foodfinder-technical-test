import type Stripe from "stripe";

import type { OpenFoodFactsProduct, SupportedLanguage } from "./product.ts";

export type DemoUser = {
  id: string;
  email: string;
  stripeCustomerId: string | null;
  subscription: {
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

export type RecentSearch = {
  id: string;
  query: string;
  language: string;
  createdAt: Date;
};

export type SubscriptionUpdate = {
  userId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export interface DataStore {
  getDemoUser(): Promise<DemoUser>;
  saveSearch(userId: string, query: string, language: SupportedLanguage): Promise<void>;
  getRecentSearches(userId: string, limit: number): Promise<RecentSearch[]>;
  updateStripeCustomer(userId: string, stripeCustomerId: string): Promise<void>;
  findUserByStripeCustomerId(stripeCustomerId: string): Promise<{ id: string } | null>;
  upsertSubscription(update: SubscriptionUpdate): Promise<void>;
  hasProcessedStripeEvent(eventId: string): Promise<boolean>;
  recordStripeEvent(eventId: string, type: string): Promise<void>;
}

export interface ProductProvider {
  search(query: string, language: SupportedLanguage): Promise<OpenFoodFactsProduct[]>;
}

export interface StripeGateway {
  createCustomer(email: string, userId: string): Promise<string>;
  createCheckoutSession(customerId: string, userId: string): Promise<string>;
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event;
  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  hasPremiumPrice(subscription: Stripe.Subscription): boolean;
}

export type AppDependencies = {
  store: DataStore;
  productProvider: ProductProvider;
  stripe: StripeGateway;
};
