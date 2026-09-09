import { config } from "../config.ts";
import type { ProductProvider } from "../types/dependencies.ts";
import type { OpenFoodFactsProduct, SupportedLanguage } from "../types/product.ts";
import { HttpError } from "../utils/httpError.ts";

const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "product_name_nl",
  "product_name_de",
  "product_name_fr",
  "generic_name",
  "generic_name_en",
  "generic_name_nl",
  "generic_name_de",
  "generic_name_fr",
  "brands",
  "image_front_small_url",
  "image_small_url",
  "image_front_url",
  "image_url",
  "quantity",
  "nutriments",
  "nutrition_data_per",
].join(",");

type SearchResponse = {
  products?: unknown;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ServiceOptions = {
  fetcher?: FetchLike;
  wait?: (milliseconds: number) => Promise<void>;
  requestTimeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaxAgeMs?: number;
  now?: () => number;
};

type CacheEntry = {
  products: OpenFoodFactsProduct[];
  fetchedAt: number;
  refreshAfter: number;
};

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 750;
const DEFAULT_CACHE_TTL_MS = 30 * 60_000;
const DEFAULT_CACHE_MAX_AGE_MS = 60 * 60_000;
const REFRESH_COOLDOWN_MS = 60_000;
const MAX_CACHE_ENTRIES = 50;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 500, 502, 503, 504]);

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const isTimeout = (error: unknown): boolean =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

export class OpenFoodFactsService implements ProductProvider {
  private readonly fetcher: FetchLike;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly requestTimeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cacheMaxAgeMs: number;
  private readonly now: () => number;
  private rateLimitedUntil = 0;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<OpenFoodFactsProduct[]>>();

  constructor(options: ServiceOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.wait = options.wait ?? wait;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 8_000;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.cacheMaxAgeMs = options.cacheMaxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
    this.now = options.now ?? Date.now;
  }

  async search(query: string, language: SupportedLanguage): Promise<OpenFoodFactsProduct[]> {
    const normalizedQuery = query.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(language);
    const cacheKey = `${language}:${normalizedQuery}`;
    const cached = this.cache.get(cacheKey);
    const now = this.now();
    // Empty results should expire normally rather than hiding newly added products.
    const maxAge = cached?.products.length ? this.cacheMaxAgeMs : this.cacheTtlMs;
    if (cached && now - cached.fetchedAt < maxAge) {
      // Recently successful data stays usable while a single refresh runs.
      if (now >= cached.refreshAfter && now >= this.rateLimitedUntil && !this.inFlight.has(cacheKey)) {
        cached.refreshAfter = now + REFRESH_COOLDOWN_MS;
        void this.loadProducts(cacheKey, normalizedQuery, language).catch(() => {
          cached.refreshAfter = this.now() + REFRESH_COOLDOWN_MS;
        });
      }
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.products;
    }
    if (cached) this.cache.delete(cacheKey);

    return this.loadProducts(cacheKey, normalizedQuery, language);
  }

  private loadProducts(
    cacheKey: string,
    query: string,
    language: SupportedLanguage,
  ): Promise<OpenFoodFactsProduct[]> {
    const existingRequest = this.inFlight.get(cacheKey);
    if (existingRequest) return existingRequest;

    const request = this.fetchProducts(query, language)
      .then((products) => {
        this.cache.delete(cacheKey);
        if (this.cache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = this.cache.keys().next().value;
          if (oldestKey) this.cache.delete(oldestKey);
        }
        const fetchedAt = this.now();
        this.cache.set(cacheKey, { products, fetchedAt, refreshAfter: fetchedAt + this.cacheTtlMs });
        return products;
      })
      .finally(() => this.inFlight.delete(cacheKey));

    this.inFlight.set(cacheKey, request);
    return request;
  }

  private async fetchProducts(
    query: string,
    language: SupportedLanguage,
  ): Promise<OpenFoodFactsProduct[]> {
    if (this.now() < this.rateLimitedUntil) {
      throw new HttpError(429, "PRODUCT_SEARCH_RATE_LIMITED", "Open Food Facts search rate limit reached. Please wait before trying again.");
    }
    const url = new URL("/cgi/search.pl", config.openFoodFactsBaseUrl);
    url.search = new URLSearchParams({
      action: "process",
      search_terms: query,
      json: "1",
      page_size: "12",
      // The UI needs the first page, not an expensive total count of every match.
      no_count: "1",
      fields: PRODUCT_FIELDS,
      lc: language,
    }).toString();

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.fetcher(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": config.openFoodFactsUserAgent,
          },
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const seconds = retryAfter === null ? NaN : Number(retryAfter);
          const retryAt = Number.isFinite(seconds)
            ? this.now() + Math.max(0, seconds) * 1_000
            : Date.parse(retryAfter ?? "");
          this.rateLimitedUntil = Math.max(this.now() + REFRESH_COOLDOWN_MS, Number.isFinite(retryAt) ? retryAt : 0);
          throw new HttpError(
            429,
            "PRODUCT_SEARCH_RATE_LIMITED",
            "Open Food Facts search rate limit reached. Please wait before trying again.",
          );
        }

        if (!response.ok) {
          console.warn("Open Food Facts request failed", { status: response.status, attempt });
          await response.body?.cancel();
          if (attempt < MAX_ATTEMPTS && RETRYABLE_STATUS_CODES.has(response.status)) {
            await this.wait(RETRY_DELAY_MS);
            continue;
          }
          throw new HttpError(502, "PRODUCT_SEARCH_FAILED", "Open Food Facts returned an error.");
        }

        try {
          const body = (await response.json()) as SearchResponse;
          if (!body || !Array.isArray(body.products)) throw new Error("Invalid product search response");
          return body.products as OpenFoodFactsProduct[];
        } catch (error) {
          if (isTimeout(error)) throw error;
          lastError = error;
          if (attempt < MAX_ATTEMPTS) {
            await this.wait(RETRY_DELAY_MS);
            continue;
          }
          throw new HttpError(502, "PRODUCT_SEARCH_FAILED", "Open Food Facts returned invalid data.");
        }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        lastError = error;
        if (attempt < MAX_ATTEMPTS) {
          await this.wait(RETRY_DELAY_MS);
          continue;
        }
      }
    }

    throw new HttpError(
      isTimeout(lastError) ? 504 : 502,
      isTimeout(lastError) ? "PRODUCT_SEARCH_TIMEOUT" : "PRODUCT_SEARCH_FAILED",
      isTimeout(lastError)
        ? "Open Food Facts took too long to respond."
        : "Open Food Facts could not be reached.",
    );
  }
}
