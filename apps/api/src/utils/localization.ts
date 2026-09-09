import type { OpenFoodFactsProduct, SupportedLanguage } from "../types/product.ts";

const unknownProduct: Record<SupportedLanguage, string> = {
  en: "Unknown product",
  nl: "Onbekend product",
  de: "Unbekanntes Produkt",
  fr: "Produit inconnu",
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const selectLocalizedProductName = (
  product: OpenFoodFactsProduct,
  language: SupportedLanguage,
): string => {
  const localizedProductName = text(product[`product_name_${language}`]);
  const localizedGenericName = text(product[`generic_name_${language}`]);

  return (
    localizedProductName ??
    text(product.product_name) ??
    text(product.product_name_en) ??
    localizedGenericName ??
    text(product.generic_name) ??
    unknownProduct[language]
  );
};

export const nullableText = text;
