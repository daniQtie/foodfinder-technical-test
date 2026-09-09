import type {
  NutritionInfo,
  OpenFoodFactsProduct,
  ProductDto,
  SupportedLanguage,
} from "../types/product.ts";
import { nullableText, selectLocalizedProductName } from "./localization.ts";

const nullableNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const OPEN_FOOD_FACTS_IMAGE_HOSTS = new Set([
  "images.openfoodfacts.org",
  "static.openfoodfacts.org",
]);

const normalizeImageUrl = (value: unknown): string | null => {
  const candidate = nullableText(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    // Both official hosts serve these product assets. The static host avoids
    // connection timeouts observed on the images host on the demo network.
    if (url.hostname === "images.openfoodfacts.org" && url.pathname.startsWith("/images/products/")) {
      url.hostname = "static.openfoodfacts.org";
    }
    return url.protocol === "https:" && OPEN_FOOD_FACTS_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const normalizeNutrition = (product: OpenFoodFactsProduct): NutritionInfo => {
  const nutriments = product.nutriments ?? {};

  return {
    energyKcal100g: nullableNumber(nutriments["energy-kcal_100g"]),
    fat100g: nullableNumber(nutriments.fat_100g),
    saturatedFat100g: nullableNumber(nutriments["saturated-fat_100g"]),
    carbohydrates100g: nullableNumber(nutriments.carbohydrates_100g),
    sugars100g: nullableNumber(nutriments.sugars_100g),
    protein100g: nullableNumber(nutriments.proteins_100g),
    salt100g: nullableNumber(nutriments.salt_100g),
  };
};

export const normalizeProduct = (
  product: OpenFoodFactsProduct,
  language: SupportedLanguage,
  includeNutrition: boolean,
): ProductDto => {
  const nutrition = normalizeNutrition(product);
  const basicProduct = {
    code: nullableText(product.code) ?? "",
    name: selectLocalizedProductName(product, language),
    brand: nullableText(product.brands),
    // Small variants are sufficient for cards and load much faster than original uploads.
    imageUrl:
      normalizeImageUrl(product.image_front_small_url) ??
      normalizeImageUrl(product.image_small_url) ??
      normalizeImageUrl(product.image_front_url) ??
      normalizeImageUrl(product.image_url),
    quantity: nullableText(product.quantity),
    nutritionAvailable: Object.values(nutrition).some((value) => value !== null),
  };

  return includeNutrition ? { ...basicProduct, nutrition } : basicProduct;
};
