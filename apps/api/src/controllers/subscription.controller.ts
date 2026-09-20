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

export const createCheckoutConfirmationController = (
  service: SubscriptionService,
): RequestHandler => async (request, response) => {
  const body: unknown = request.body;
  const sessionId =
    typeof body === "object" &&
    body !== null &&
    "sessionId" in body &&
    typeof body.sessionId === "string"
      ? body.sessionId.trim()
      : "";
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 255) {
    throw new HttpError(400, "INVALID_CHECKOUT_SESSION", "Checkout could not be confirmed.");
  }

  try {
    response.json(await service.confirmCheckout(sessionId));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "CHECKOUT_CONFIRMATION_FAILED", "Checkout confirmation is unavailable.");
  }
};
