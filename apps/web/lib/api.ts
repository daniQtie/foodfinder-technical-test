import type { Language } from "./i18n";
import type { RecentSearch, SearchResponse, SubscriptionStatus } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store" });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    const error = typeof body === "object" && body !== null && "error" in body ? body.error : undefined;
    throw new ApiError(error?.code ?? "REQUEST_FAILED", error?.message ?? "Request failed.");
  }
  return body as T;
};

export const searchProducts = (query: string, language: Language, signal?: AbortSignal) =>
  request<SearchResponse>(
    `/api/products/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(language)}`,
    { signal },
  );

export const getRecentSearches = () =>
  request<{ searches: RecentSearch[] }>("/api/searches/recent");

export const getSubscriptionStatus = () =>
  request<SubscriptionStatus>("/api/subscription/status");

export const createCheckout = () =>
  request<{ url: string }>("/api/subscription/checkout", { method: "POST" });
