import { Router } from "express";

import { createSearchProductsController } from "../controllers/products.controller.ts";
import { ProductService } from "../services/product.service.ts";
import type { AppDependencies } from "../types/dependencies.ts";

export const createProductsRouter = (dependencies: AppDependencies) => {
  const router = Router();
  router.get("/search", createSearchProductsController(new ProductService(dependencies)));
  return router;
};
