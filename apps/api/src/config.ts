import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Scripts may execute from the repository root or apps/api. Using cwd candidates
// keeps the root .env discoverable after TypeScript emits files into dist/.
const envPath = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")].find(existsSync);
dotenv.config(envPath ? { path: envPath } : undefined);

const getRequired = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  openFoodFactsBaseUrl:
    process.env.OPEN_FOOD_FACTS_BASE_URL ?? "https://world.openfoodfacts.org",
  openFoodFactsUserAgent:
    process.env.OPEN_FOOD_FACTS_USER_AGENT ??
    "FoodFinderTechnicalTest/1.0 (development; configure contact in OPEN_FOOD_FACTS_USER_AGENT)",
  get databaseUrl() {
    return getRequired("DATABASE_URL");
  },
  get stripeSecretKey() {
    return getRequired("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return getRequired("STRIPE_WEBHOOK_SECRET");
  },
  get stripePriceId() {
    return getRequired("STRIPE_PRICE_ID");
  },
};
