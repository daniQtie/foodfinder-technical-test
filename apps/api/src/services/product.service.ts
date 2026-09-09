import type { AppDependencies } from "../types/dependencies.ts";
import type { SupportedLanguage } from "../types/product.ts";
import { normalizeProduct } from "../utils/normalizeProduct.ts";
import { hasPremiumAccess } from "../utils/premiumAccess.ts";

export class ProductService {
  constructor(private readonly dependencies: Pick<AppDependencies, "store" | "productProvider">) {}

  async search(query: string, language: SupportedLanguage) {
    const user = await this.dependencies.store.getDemoUser();
    await this.dependencies.store.saveSearch(user.id, query, language);

    const rawProducts = await this.dependencies.productProvider.search(query, language);
    // The request may have waited on OFF while a cancellation webhook was processed.
    const currentUser = await this.dependencies.store.getDemoUser();
    const includeNutrition = hasPremiumAccess(currentUser.subscription?.status);

    return rawProducts.map((product) => normalizeProduct(product, language, includeNutrition));
  }
}
