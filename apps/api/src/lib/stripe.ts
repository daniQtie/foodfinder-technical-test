import Stripe from "stripe";

import { config } from "../config.ts";

export const stripeClient = new Stripe(config.stripeSecretKey, {
  maxNetworkRetries: 2,
  timeout: 10_000,
});
