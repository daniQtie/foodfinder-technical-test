import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.ts";
import { makeDependencies } from "./helpers/fakes.ts";

describe("GET /api/searches/recent", () => {
  it("returns newest-first records from the store and applies the limit", async () => {
    const dependencies = makeDependencies();
    dependencies.store.recentSearches = [
      { id: "new", query: "Oreo", language: "en", createdAt: new Date("2026-09-05T12:00:00Z") },
      { id: "old", query: "Muesli", language: "de", createdAt: new Date("2026-09-05T11:00:00Z") },
    ];

    const response = await request(createApp(dependencies)).get("/api/searches/recent").expect(200);

    expect(response.body.searches.map((search: { id: string }) => search.id)).toEqual(["new", "old"]);
    expect(dependencies.store.lastRecentLimit).toBe(8);
  });
});
