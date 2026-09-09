import type { RequestHandler } from "express";

import type { ProductService } from "../services/product.service.ts";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../types/product.ts";
import { HttpError } from "../utils/httpError.ts";

const isLanguage = (value: string): value is SupportedLanguage =>
  SUPPORTED_LANGUAGES.some((language) => language === value);

export const createSearchProductsController = (service: ProductService): RequestHandler =>
  async (request, response) => {
    const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
    const requestedLanguage = typeof request.query.lang === "string" ? request.query.lang : "en";

    if (!query || query.length > 100) {
      throw new HttpError(
        400,
        "INVALID_QUERY",
        query.length > 100 ? "Search query must be 100 characters or fewer." : "Search query is required.",
      );
    }
    if (!isLanguage(requestedLanguage)) {
      throw new HttpError(400, "INVALID_LANGUAGE", "Supported languages are en, nl, de, and fr.");
    }

    const products = await service.search(query, requestedLanguage);
    response.json({ query, language: requestedLanguage, products });
  };
