import type { RequestHandler } from "express";

import type { DataStore } from "../types/dependencies.ts";

export const createRecentSearchesController = (store: DataStore): RequestHandler =>
  async (_request, response) => {
    const user = await store.getDemoUser();
    const searches = await store.getRecentSearches(user.id, 8);
    response.json({
      searches: searches.map((search) => ({
        ...search,
        createdAt: search.createdAt.toISOString(),
      })),
    });
  };
