import type { RequestHandler } from "express";

import type { SubscriptionService } from "../services/subscription.service.ts";
import type { StripeGateway } from "../types/dependencies.ts";

export const createStripeWebhookController = (
  stripe: StripeGateway,
  subscriptionService: SubscriptionService,
): RequestHandler => async (request, response) => {
  const signature = request.header("stripe-signature");
  if (!signature || !Buffer.isBuffer(request.body)) {
    response.status(400).json({
      error: { code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid Stripe webhook signature." },
    });
    return;
  }

  let event;
  try {
    event = stripe.constructWebhookEvent(request.body, signature);
  } catch {
    response.status(400).json({
      error: { code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid Stripe webhook signature." },
    });
    return;
  }

  const result = await subscriptionService.processEvent(event);
  response.json({ received: true, result });
};
