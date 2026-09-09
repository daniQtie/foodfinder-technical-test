"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, createCheckout, getRecentSearches, getSubscriptionStatus, searchProducts } from "@/lib/api";
import { isLanguage, messages, type Language } from "@/lib/i18n";
import type { Product, RecentSearch, SubscriptionStatus } from "@/lib/types";
import { CheckIcon, SearchIcon } from "./icons";
import { LanguageSelector } from "./LanguageSelector";
import { ProductCard } from "./ProductCard";
import { SearchSkeleton } from "./SearchSkeleton";

const LANGUAGE_STORAGE_KEY = "foodfinder-language";

export function FoodFinderApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState(false);
  const activeSearch = useRef<AbortController | null>(null);
  const copy = messages[language];

  const refreshRecent = useCallback(async () => {
    try {
      setRecent((await getRecentSearches()).searches);
    } catch {
      // History is secondary; a database outage here must not disable product search.
    }
  }, []);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    window.queueMicrotask(() => {
      if (isLanguage(savedLanguage)) setLanguage(savedLanguage);
      void refreshRecent();
      void getSubscriptionStatus().then(setSubscription).catch(() => setSubscription(null));
    });
    return () => activeSearch.current?.abort();
  }, [refreshRecent]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const performSearch = useCallback(async (value: string, searchLanguage: Language) => {
    const normalizedQuery = value.trim();
    if (!normalizedQuery) return { count: 0 };
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setLoading(true);
    setError(null);
    setCheckoutError(false);
    setLastQuery(normalizedQuery);
    try {
      const response = await searchProducts(normalizedQuery, searchLanguage, controller.signal);
      if (controller.signal.aborted) return { count: 0 };
      setProducts(response.products);
      void refreshRecent();
      return { count: response.products.length, query: response.query, language: response.language };
    } catch (searchError) {
      if (controller.signal.aborted) return { count: 0 };
      if (searchError instanceof DOMException && searchError.name === "AbortError") return { count: 0 };
      setProducts(null);
      setError(
        searchError instanceof ApiError && searchError.code === "PRODUCT_SEARCH_RATE_LIMITED"
          ? messages[searchLanguage].rateLimitDescription
          : searchError instanceof ApiError && searchError.code === "PRODUCT_SEARCH_TIMEOUT"
            ? messages[searchLanguage].timeoutDescription
            : messages[searchLanguage].errorDescription,
      );
      throw searchError;
    } finally {
      if (activeSearch.current === controller) setLoading(false);
    }
  }, [refreshRecent]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "search_products",
      title: "Search packaged food products",
      description: "Search Open Food Facts through FoodFinder and display the results in the current page.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 100 } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        if (!input || typeof input !== "object" || !("query" in input) || typeof input.query !== "string") throw new Error("A query string is required.");
        setQuery(input.query);
        return performSearch(input.query, language);
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [language, performSearch]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void performSearch(query, language).catch(() => undefined);
  };

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    if (lastQuery) void performSearch(lastQuery, nextLanguage).catch(() => undefined);
  };

  const repeatSearch = (value: string) => {
    setQuery(value);
    void performSearch(value, language).catch(() => undefined);
  };

  const subscribe = async () => {
    setCheckoutLoading(true);
    setCheckoutError(false);
    try {
      window.location.assign((await createCheckout()).url);
    } catch {
      setCheckoutError(true);
      setCheckoutLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <a href="#search" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">{copy.searchLabel}</a>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color:var(--surface)]/92 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="#search" className="flex items-center gap-3 font-semibold tracking-[-0.03em]"><span className="grid size-9 place-items-center rounded-full bg-[var(--forest)] text-sm text-white">F</span><span className="text-xl">{copy.appName}</span></a>
          <div className="flex items-center gap-2 sm:gap-3">
            {subscription?.isActive && <span className="hidden items-center gap-1.5 rounded-full bg-[#dcebdd] px-3 py-2 text-xs font-semibold text-[#1d633a] sm:flex"><CheckIcon className="size-4" /> {copy.premium}</span>}
            <LanguageSelector language={language} label={copy.language} onChange={changeLanguage} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
        <div>
          <div className="max-w-3xl"><p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-dark)]">{copy.searchEyebrow}</p><h1 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl">{copy.searchTitle}</h1><p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">{copy.searchDescription}</p></div>
        </div>

        <form onSubmit={submit} className="mt-9 flex max-w-5xl flex-col gap-3 rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_24px_80px_rgba(18,61,43,0.08)] sm:flex-row">
          <label htmlFor="search" className="sr-only">{copy.searchLabel}</label>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3"><SearchIcon className="size-5 shrink-0 text-[var(--muted)]" /><input id="search" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-[#89958c]" /></div>
          <button type="submit" disabled={loading || !query.trim()} className="rounded-2xl bg-[var(--accent)] px-7 py-4 font-semibold text-white transition hover:bg-[var(--accent-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)] disabled:cursor-not-allowed disabled:opacity-55">{loading ? copy.searching : copy.searchButton}</button>
        </form>

        {recent.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={copy.recentSearches}><span className="mr-1 text-sm font-medium text-[var(--muted)]">{copy.recentSearches}</span>{recent.map((search) => <button key={search.id} type="button" onClick={() => repeatSearch(search.query)} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-sm transition hover:border-[var(--forest)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">{search.query}</button>)}</div>}
        {checkoutError && <div role="alert" className="mt-5 max-w-5xl rounded-xl border border-[#edc6b8] bg-[#fff4ef] px-4 py-3 text-sm text-[var(--accent-dark)]">{copy.subscriptionError}</div>}

        <section className="mt-12" aria-live="polite" aria-busy={loading}>
          {loading ? <SearchSkeleton /> : error ? (
            <div className="rounded-[1.75rem] border border-[#edc6b8] bg-[#fff4ef] px-6 py-12 text-center"><h2 className="text-xl font-semibold">{copy.errorTitle}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">{error}</p><button type="button" onClick={() => void performSearch(lastQuery, language).catch(() => undefined)} className="mt-5 rounded-xl bg-[var(--forest)] px-5 py-3 text-sm font-semibold text-white">{copy.tryAgain}</button></div>
          ) : products === null ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#b8c2b7] bg-white/50 px-6 py-12 text-center"><p className="text-lg font-medium">{copy.initialTitle}</p><p className="mt-2 text-[var(--muted)]">{copy.initialDescription}</p></div>
          ) : products.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#b8c2b7] bg-white/50 px-6 py-12 text-center"><h2 className="text-xl font-semibold">{copy.noResults}</h2><p className="mt-2 text-[var(--muted)]">{copy.noResultsDescription}</p></div>
          ) : (
            <><div className="mb-5 flex items-end justify-between gap-4"><div><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-dark)]">{copy.results}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">“{lastQuery}”</h2></div>{subscription?.isActive && <span className="text-sm font-medium text-[#1d633a]">{copy.subscriptionActive}</span>}</div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((product, index) => <ProductCard key={`${product.code || "product"}-${index}`} product={product} copy={copy} checkoutLoading={checkoutLoading} onSubscribe={subscribe} />)}</div></>
          )}
        </section>
      </section>
    </main>
  );
}
