import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.ts";
import { makeDependencies } from "./helpers/fakes.ts";

describe("GET /api/products/search", () => {
  const dependencies = makeDependencies();
  const app = createApp(dependencies);

  beforeEach(() => {
    dependencies.store.user.subscription = null;
    dependencies.store.savedSearches = [];
    dependencies.productProvider.products = [
      {
        code: "3017620422003",
        product_name: "Nutella",
        nutriments: { "energy-kcal_100g": 539, fat_100g: 30.9 },
      },
    ];
  });

  it("omits nutrition from the actual HTTP response for a free user", async () => {
    const response = await request(app).get("/api/products/search?q=nutella&lang=en").expect(200);

    expect(response.body.products[0]).not.toHaveProperty("nutrition");
    expect(response.body.products[0]).toMatchObject({ name: "Nutella", nutritionAvailable: true });
  });

  it("includes nutrition for an active subscription", async () => {
    dependencies.store.user.subscription = {
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };

    const response = await request(app).get("/api/products/search?q=nutella&lang=en").expect(200);
    expect(response.body.products[0].nutrition).toMatchObject({ energyKcal100g: 539, fat100g: 30.9 });
  });

  it("persists each valid normalized search for the server-resolved demo user", async () => {
    await request(app).get("/api/products/search?q=%20crème%20brûlée%20&lang=fr").expect(200);

    expect(dependencies.store.savedSearches).toEqual([
      { userId: "demo-user", query: "crème brûlée", language: "fr" },
    ]);
  });

  it.each([
    ["/api/products/search?q=%20%20%20", "INVALID_QUERY"],
    ["/api/products/search?q=nutella&lang=es", "INVALID_LANGUAGE"],
  ])("validates %s", async (url, code) => {
    const response = await request(app).get(url).expect(400);
    expect(response.body).toMatchObject({ error: { code } });
    expect(dependencies.productProvider.calls).toBeDefined();
  });
});
