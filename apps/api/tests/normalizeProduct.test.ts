import { describe, expect, it } from "vitest";

import { normalizeProduct } from "../src/utils/normalizeProduct.ts";

describe("normalizeProduct", () => {
  it("uses the reachable official static host for product assets", () => {
    expect(normalizeProduct({
      image_front_small_url: "https://images.openfoodfacts.org/images/products/501/002/900/0023/front_en.121.200.jpg",
    }, "en", false).imageUrl).toBe("https://static.openfoodfacts.org/images/products/501/002/900/0023/front_en.121.200.jpg");
  });
  it("maps basic fields and nutrition into the stable DTO", () => {
    const product = normalizeProduct(
      {
        code: "3017620422003",
        product_name: "Nutella",
        brands: "Ferrero",
        image_front_url: "https://images.openfoodfacts.org/nutella.jpg",
        quantity: "400 g",
        nutriments: {
          "energy-kcal_100g": 539,
          fat_100g: "30.9",
          "saturated-fat_100g": 10.6,
          carbohydrates_100g: 57.5,
          sugars_100g: 56.3,
          proteins_100g: 6.3,
          salt_100g: 0.107,
        },
      },
      "en",
      true,
    );

    expect(product).toMatchObject({
      code: "3017620422003",
      name: "Nutella",
      brand: "Ferrero",
      imageUrl: "https://images.openfoodfacts.org/nutella.jpg",
      nutritionAvailable: true,
      nutrition: { energyKcal100g: 539, fat100g: 30.9, salt100g: 0.107 },
    });
  });

  it("normalizes missing and invalid external values to null without crashing", () => {
    const product = normalizeProduct(
      {
        code: "missing-fields",
        nutriments: { fat_100g: "not-a-number", sugars_100g: Number.NaN },
      },
      "de",
      true,
    );

    expect(product).toEqual({
      code: "missing-fields",
      name: "Unbekanntes Produkt",
      brand: null,
      imageUrl: null,
      quantity: null,
      nutritionAvailable: false,
      nutrition: {
        energyKcal100g: null,
        fat100g: null,
        saturatedFat100g: null,
        carbohydrates100g: null,
        sugars100g: null,
        protein100g: null,
        salt100g: null,
      },
    });
  });

  it("prefers a requested localized name and falls back to the base name", () => {
    expect(
      normalizeProduct({ product_name: "Hazelnut spread", product_name_fr: "Pâte à tartiner" }, "fr", false)
        .name,
    ).toBe("Pâte à tartiner");
    expect(normalizeProduct({ product_name: "Hazelnut spread" }, "fr", false).name).toBe(
      "Hazelnut spread",
    );
  });

  it("rejects external or unsafe image URLs from community-controlled data", () => {
    const product = normalizeProduct(
      { product_name: "Example", image_front_url: "javascript:alert(1)", image_url: "https://tracker.example/image.jpg" },
      "en",
      false,
    );

    expect(product.imageUrl).toBeNull();
  });

  it("prefers the smaller Open Food Facts image used by product cards", () => {
    const product = normalizeProduct(
      {
        product_name: "Example",
        image_front_small_url: "https://images.openfoodfacts.org/small.jpg",
        image_front_url: "https://images.openfoodfacts.org/original.jpg",
      },
      "en",
      false,
    );

    expect(product.imageUrl).toBe("https://images.openfoodfacts.org/small.jpg");
  });
});
