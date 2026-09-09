import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.ts";
import { makeDependencies, makeEvent, makeSubscription } from "./helpers/fakes.ts";

describe("POST /api/stripe/webhook", () => {
  it("rejects an invalid Stripe signature", async () => {
    const dependencies = makeDependencies();
    dependencies.stripe.rejectSignature = true;

    const response = await request(createApp(dependencies))
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "invalid")
      .send(JSON.stringify({ id: "evt_invalid" }))
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  });

  it("processes a valid mocked webhook and ignores a replay", async () => {
    const dependencies = makeDependencies();
    dependencies.stripe.webhookEvent = makeEvent(
      "customer.subscription.updated",
      makeSubscription("active"),
      "evt_once",
    );
    const app = createApp(dependencies);

    await request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "valid")
      .send("{}")
      .expect(200, { received: true, result: "processed" });

    await request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "valid")
      .send("{}")
      .expect(200, { received: true, result: "duplicate" });

    expect(dependencies.store.subscriptionUpdates).toHaveLength(1);
  });

  it("synchronizes active and canceled subscription states", async () => {
    const dependencies = makeDependencies();
    const app = createApp(dependencies);

    dependencies.stripe.webhookEvent = makeEvent(
      "customer.subscription.updated",
      makeSubscription("active"),
      "evt_active",
    );
    await request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "valid")
      .send("{}")
      .expect(200);
    expect(dependencies.store.user.subscription?.status).toBe("active");

    dependencies.stripe.webhookEvent = makeEvent(
      "customer.subscription.deleted",
      makeSubscription("canceled"),
      "evt_canceled",
    );
    await request(app)
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "valid")
      .send("{}")
      .expect(200);
    expect(dependencies.store.user.subscription?.status).toBe("canceled");
  });

  it("uses the latest Stripe subscription instead of a stale event snapshot", async () => {
    const dependencies = makeDependencies();
    dependencies.stripe.webhookEvent = makeEvent(
      "customer.subscription.updated",
      makeSubscription("active"),
      "evt_stale",
    );
    dependencies.stripe.retrievedSubscription = makeSubscription("canceled");

    await request(createApp(dependencies))
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "valid")
      .send("{}")
      .expect(200);

    expect(dependencies.store.user.subscription?.status).toBe("canceled");
  });

  it("ignores active subscriptions for an unrelated Stripe price", async () => {
    const dependencies = makeDependencies();
    dependencies.stripe.premiumPrice = false;
    dependencies.stripe.webhookEvent = makeEvent(
      "customer.subscription.updated",
      makeSubscription("active"),
      "evt_wrong_price",
    );

    const response = await request(createApp(dependencies))
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "valid")
      .send("{}")
      .expect(200);

    expect(response.body.result).toBe("ignored");
    expect(dependencies.store.subscriptionUpdates).toHaveLength(0);
  });

  it("rejects a subscription that cannot be mapped to the seeded demo user", async () => {
    const dependencies = makeDependencies();
    dependencies.stripe.webhookEvent = makeEvent(
      "customer.subscription.updated",
      makeSubscription("active", {
        customer: "cus_unknown",
        metadata: { demoUserId: "another-user" },
      }),
      "evt_wrong_user",
    );

    await request(createApp(dependencies))
      .post("/api/stripe/webhook")
      .set("content-type", "application/json")
      .set("stripe-signature", "valid")
      .send("{}")
      .expect(400);

    expect(dependencies.store.subscriptionUpdates).toHaveLength(0);
  });

  it("blocks creation of a second checkout while premium is active", async () => {
    const dependencies = makeDependencies();
    dependencies.store.user.subscription = {
      status: "active",
      currentPeriodEnd: new Date("2030-01-01T00:00:00Z"),
      cancelAtPeriodEnd: false,
    };

    const response = await request(createApp(dependencies))
      .post("/api/subscription/checkout")
      .expect(409);

    expect(response.body.error.code).toBe("SUBSCRIPTION_ALREADY_ACTIVE");
    expect(dependencies.stripe.checkoutCalls).toBe(0);
  });
});
