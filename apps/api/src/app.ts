import cors from "cors";
import express from "express";

import { config } from "./config.ts";
import { createStripeWebhookController } from "./controllers/stripeWebhook.controller.ts";
import { errorMiddleware } from "./middleware/error.middleware.ts";
import { createProductsRouter } from "./routes/products.routes.ts";
import { createSearchesRouter } from "./routes/searches.routes.ts";
import { createSubscriptionRouter } from "./routes/subscription.routes.ts";
import { SubscriptionService } from "./services/subscription.service.ts";
import type { AppDependencies } from "./types/dependencies.ts";

export const createApp = (dependencies: AppDependencies) => {
  const app = express();

  app.use(
    cors({
      origin: config.appUrl,
      methods: ["GET", "POST"],
    }),
  );

  // Stripe requires the exact raw bytes; this route must precede express.json().
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json", limit: "256kb" }),
    createStripeWebhookController(
      dependencies.stripe,
      new SubscriptionService(dependencies),
    ),
  );
  app.use(express.json({ limit: "32kb" }));

  // Search and subscription responses depend on current server-side user state.
  app.use("/api", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api/products", createProductsRouter(dependencies));
  app.use("/api/searches", createSearchesRouter(dependencies.store));
  app.use("/api/subscription", createSubscriptionRouter(dependencies));

  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });
  app.use(errorMiddleware);

  return app;
};
