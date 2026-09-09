import type { Language } from "./i18n";

export type NutritionInfo = {
  energyKcal100g: number | null;
  fat100g: number | null;
  saturatedFat100g: number | null;
  carbohydrates100g: number | null;
  sugars100g: number | null;
  protein100g: number | null;
  salt100g: number | null;
};

export type Product = {
  code: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  quantity: string | null;
  nutritionAvailable: boolean;
  nutrition?: NutritionInfo;
};

export type SearchResponse = {
  query: string;
  language: Language;
  products: Product[];
};

export type RecentSearch = {
  id: string;
  query: string;
  language: Language;
  createdAt: string;
};

export type SubscriptionStatus = {
  isActive: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};
