import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.ts";
import { OpenFoodFactsService } from "../src/services/openFoodFacts.service.ts";
import { makeDependencies } from "./helpers/fakes.ts";

const product = {
  code: "3017620422003",
  product_name: "Nutella",
  nutriments: { "energy-kcal_100g": 539, fat_100g: 30.9 },
};

const activeSubscription = {
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

describe("product cache HTTP authorization", () => {
  it.each(["canceled", null])(
    "omits protected nutrition after a cached premium search when subscription is %s",
    async (status) => {
      const dependencies = makeDependencies();
      const fetcher = vi.fn(async () => Response.json({ products: [product] }));
      const productProvider = new OpenFoodFactsService({ fetcher });
      const app = createApp({ ...dependencies, productProvider });
      dependencies.store.user.subscription = { ...activeSubscription };

      const premiumResponse = await request(app)
        .get("/api/products/search?q=nutella&lang=en").expect(200);
      expect(premiumResponse.body.products[0].nutrition).toMatchObject({ energyKcal100g: 539 });

      dependencies.store.user.subscription = status
        ? { ...activeSubscription, status }
        : null;
      const freeResponse = await request(app)
        .get("/api/products/search?q=nutella&lang=en").expect(200);

      expect(freeResponse.body.products[0]).toMatchObject({
        name: "Nutella", nutritionAvailable: true,
      });
      expect(freeResponse.body.products[0]).not.toHaveProperty("nutrition");
      expect(freeResponse.headers["cache-control"]).toBe("no-store");
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it("rechecks subscription after cancellation while the upstream search is pending", async () => {
    const dependencies = makeDependencies();
    dependencies.store.user.subscription = { ...activeSubscription };
    // A database read returns a snapshot, not the mutable fake store's object.
    const getDemoUser = vi.spyOn(dependencies.store, "getDemoUser")
      .mockImplementation(async () => structuredClone(dependencies.store.user));
    const upstreamStarted = deferred<void>();
    const upstreamResponse = deferred<Response>();
    const fetcher = vi.fn(() => {
      upstreamStarted.resolve();
      return upstreamResponse.promise;
    });
    const app = createApp({
      ...dependencies,
      productProvider: new OpenFoodFactsService({ fetcher }),
    });

    const pendingResponse = request(app)
      .get("/api/products/search?q=nutella&lang=en").expect(200)
      .then((response) => response);
    await upstreamStarted.promise;
    expect(getDemoUser).toHaveBeenCalledOnce();
    dependencies.store.user.subscription = { ...activeSubscription, status: "canceled" };
    upstreamResponse.resolve(Response.json({ products: [product] }));

    const response = await pendingResponse;
    expect(response.body.products[0]).toMatchObject({ name: "Nutella", nutritionAvailable: true });
    expect(response.body.products[0]).not.toHaveProperty("nutrition");
    expect(getDemoUser).toHaveBeenCalledTimes(2);
  });

  it("serves stale cached data without nutrition while a refresh is still pending", async () => {
    const dependencies = makeDependencies();
    dependencies.store.user.subscription = { ...activeSubscription };
    let now = 1_000;
    const refresh = deferred<Response>();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ products: [product] }))
      .mockImplementationOnce(() => refresh.promise);
    const app = createApp({
      ...dependencies,
      productProvider: new OpenFoodFactsService({
        fetcher, now: () => now, cacheTtlMs: 1_000, cacheMaxAgeMs: 10_000,
      }),
    });
    const premiumResponse = await request(app)
      .get("/api/products/search?q=nutella&lang=en").expect(200);
    expect(premiumResponse.body.products[0]).toHaveProperty("nutrition");

    now += 1_001;
    dependencies.store.user.subscription = { ...activeSubscription, status: "canceled" };
    try {
      const freeResponse = await request(app)
        .get("/api/products/search?q=nutella&lang=en").expect(200);

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(freeResponse.body.products[0]).toMatchObject({ name: "Nutella", nutritionAvailable: true });
      expect(freeResponse.body.products[0]).not.toHaveProperty("nutrition");
    } finally {
      refresh.resolve(Response.json({ products: [product] }));
    }
  });
});
