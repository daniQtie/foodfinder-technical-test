import type { RequestHandler } from "express";

import type { SubscriptionService } from "../services/subscription.service.ts";
import { HttpError } from "../utils/httpError.ts";

export const createSubscriptionStatusController = (
  service: SubscriptionService,
): RequestHandler => async (_request, response) => {
  try {
    response.json(await service.status());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, "SUBSCRIPTION_LOOKUP_FAILED", "Subscription status is unavailable.");
  }
};

export const createCheckoutController = (service: SubscriptionService): RequestHandler =>
  async (_request, response) => {
    try {
      const url = await service.createCheckout();
      response.status(201).json({ url });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, "CHECKOUT_CREATION_FAILED", "Checkout could not be created.");
    }
  };
