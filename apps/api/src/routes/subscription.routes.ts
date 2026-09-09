import { Router } from "express";

import {
  createCheckoutController,
  createSubscriptionStatusController,
} from "../controllers/subscription.controller.ts";
import { SubscriptionService } from "../services/subscription.service.ts";
import type { AppDependencies } from "../types/dependencies.ts";

export const createSubscriptionRouter = (dependencies: AppDependencies) => {
  const router = Router();
  const service = new SubscriptionService(dependencies);
  router.get("/status", createSubscriptionStatusController(service));
  router.post("/checkout", createCheckoutController(service));
  return router;
};
