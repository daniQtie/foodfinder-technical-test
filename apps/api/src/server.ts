import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { OpenFoodFactsService } from "./services/openFoodFacts.service.ts";
import { PrismaDataStore } from "./services/prismaDataStore.ts";
import { StripeService } from "./services/stripe.service.ts";

const app = createApp({
  store: new PrismaDataStore(),
  productProvider: new OpenFoodFactsService(),
  stripe: new StripeService(),
});

app.listen(config.port, (error?: Error) => {
  if (error) {
    console.error(`FoodFinder API could not listen on port ${config.port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`FoodFinder API listening on http://localhost:${config.port}`);
});
