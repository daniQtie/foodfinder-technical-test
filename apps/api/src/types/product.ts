export const SUPPORTED_LANGUAGES = ["en", "nl", "de", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type NutritionInfo = {
  energyKcal100g: number | null;
  fat100g: number | null;
  saturatedFat100g: number | null;
  carbohydrates100g: number | null;
  sugars100g: number | null;
  protein100g: number | null;
  salt100g: number | null;
};

export type BasicProductDto = {
  code: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  quantity: string | null;
  nutritionAvailable: boolean;
};

export type PremiumProductDto = BasicProductDto & {
  nutrition: NutritionInfo;
};

export type ProductDto = BasicProductDto | PremiumProductDto;

export type OpenFoodFactsProduct = {
  code?: unknown;
  product_name?: unknown;
  product_name_en?: unknown;
  product_name_nl?: unknown;
  product_name_de?: unknown;
  product_name_fr?: unknown;
  generic_name?: unknown;
  generic_name_en?: unknown;
  generic_name_nl?: unknown;
  generic_name_de?: unknown;
  generic_name_fr?: unknown;
  brands?: unknown;
  image_front_small_url?: unknown;
  image_small_url?: unknown;
  image_front_url?: unknown;
  image_url?: unknown;
  quantity?: unknown;
  nutriments?: Record<string, unknown> | null;
  nutrition_data_per?: unknown;
};
