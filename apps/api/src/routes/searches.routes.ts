import { Router } from "express";

import { createRecentSearchesController } from "../controllers/searches.controller.ts";
import type { DataStore } from "../types/dependencies.ts";

export const createSearchesRouter = (store: DataStore) => {
  const router = Router();
  router.get("/recent", createRecentSearchesController(store));
  return router;
};
