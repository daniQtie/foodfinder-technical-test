"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, createCheckout, getRecentSearches, getSubscriptionStatus, searchProducts } from "@/lib/api";
import { isLanguage, messages, type Language } from "@/lib/i18n";
import type { Product, RecentSearch, SubscriptionStatus } from "@/lib/types";
import { ArrowIcon, CheckIcon, SearchIcon } from "./icons";
import { Brand } from "./Brand";
import { PantryScene } from "./PantryScene";
import { Reveal } from "./Reveal";
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
  const categories = [
    { kind: "cereal", label: copy.categoryCereal, query: "cereal" },
    { kind: "chocolate", label: copy.categoryChocolate, query: "chocolate" },
    { kind: "coffee", label: copy.categoryCoffee, query: "coffee" },
    { kind: "snacks", label: copy.categorySnacks, query: "crackers" },
    { kind: "dairy", label: copy.categoryDairy, query: "yogurt" },
    { kind: "spreads", label: copy.categorySpreads, query: "Nutella" },
  ];
  const uniqueRecent = recent.filter((item, index, all) => all.findIndex((other) => other.query.toLowerCase() === item.query.toLowerCase()) === index).slice(0, 5);

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
    // Keep the query and its response in the same visual flow. This is
    // especially helpful on tall screens where the editorial hero is long.
    window.requestAnimationFrame(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    document.getElementById("search")?.focus({ preventScroll: true });
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
    <main id="top" className="min-h-screen">
      <a href="#search" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">{copy.searchLabel}</a>
      <header className="site-header">
        <div className="page-width header-inner">
          <a href="#top" aria-label={copy.appName}><Brand /></a>
          <nav className="desktop-nav" aria-label={copy.appName}><a href="#explore">{copy.navExplore}</a><a href="#how-it-works">{copy.navHow}</a></nav>
          <div className="flex items-center gap-3">
            {subscription?.isActive && <span className="subscription-status">{copy.premium}</span>}
            <LanguageSelector language={language} label={copy.language} onChange={changeLanguage} />
          </div>
        </div>
      </header>

      <section className="page-width hero">
        <div className="hero-copy">
          <p className="eyebrow hero-enter"><span className="status-dot" />{copy.searchEyebrow}</p>
          <h1 className="hero-title hero-enter">{copy.heroLead}<br/><em>{copy.heroAccent}</em></h1>
          <p className="hero-description hero-enter">{copy.heroNote}<br/><span>{copy.searchDescription}</span></p>
        <form onSubmit={submit} className="search-form hero-enter" role="search">
          <label htmlFor="search" className="sr-only">{copy.searchLabel}</label>
          <div className="search-field"><SearchIcon /><input id="search" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} autoComplete="off" />{query && <button type="button" className="clear-search" aria-label={copy.clearSearch} onClick={() => { setQuery(""); document.getElementById("search")?.focus(); }}>×</button>}</div>
          <button type="submit" disabled={loading || !query.trim()} className="button button-accent search-submit">{loading ? copy.searching : copy.searchButton}<ArrowIcon /></button>
        </form>
        <div className="recent-searches hero-enter" aria-label={uniqueRecent.length ? copy.recentSearches : copy.suggestions}><span>{uniqueRecent.length ? copy.recentSearches : copy.suggestions}</span>{(uniqueRecent.length ? uniqueRecent.map((item) => item.query) : ["Nutella", "Weetabix", "Oreo"]).map((value) => <button key={value} type="button" onClick={() => repeatSearch(value)}>{value}<span aria-hidden="true">↗</span></button>)}</div>
        {checkoutError && <div role="alert" className="mt-5 max-w-5xl rounded-xl border border-[#edc6b8] bg-[#fff4ef] px-4 py-3 text-sm text-[var(--accent-dark)]">{copy.subscriptionError}</div>}
        </div>
        <PantryScene copy={copy} onSearch={repeatSearch} />
      </section>
      <div className="source-strip"><div className="page-width source-inner"><span>{copy.sourceLabel}</span><a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts <span aria-hidden="true">↗</span></a><span className="source-note">{copy.sourceNote}</span></div></div>
      <section id="explore" className="page-width explore-section">
        <Reveal><div className="section-heading"><div><p className="eyebrow">{copy.shelfLabel}</p><h2>{copy.shelfTitle}</h2></div><p>{copy.shelfNote}</p></div>
        <div className="category-list">{categories.map((category, index) => <button type="button" key={category.kind} onClick={() => repeatSearch(category.query)} className={`category-button ${lastQuery.toLowerCase() === category.query.toLowerCase() ? "is-active" : ""}`}><span className="category-index">0{index + 1}</span><span>{category.label}</span><ArrowIcon/></button>)}</div></Reveal>
        <section id="results" className="results-section" aria-live="polite" aria-busy={loading}>
          {loading ? <SearchSkeleton /> : error ? (
            <div className="state-panel error-panel"><SearchIcon className="size-8"/><h2>{copy.errorTitle}</h2><p>{error}</p><button type="button" onClick={() => void performSearch(lastQuery, language).catch(() => undefined)} className="button button-forest">{copy.tryAgain}<ArrowIcon/></button></div>
          ) : products === null ? (
            <div className="initial-note"><SearchIcon/><p>{copy.initialTitle}<span>{copy.initialDescription}</span></p><span aria-hidden="true">↗</span></div>
          ) : products.length === 0 ? (
            <div className="state-panel"><SearchIcon className="size-8"/><h2>{copy.noResults}</h2><p>{copy.noResultsDescription}</p></div>
          ) : (
            <><div className="results-heading"><div><p className="eyebrow">{copy.results}</p><h2>“{lastQuery}” <span>{products.length} {copy.resultsCount}</span></h2></div>{subscription?.isActive && <span className="subscription-status"><CheckIcon className="size-4"/>{copy.subscriptionActive}</span>}</div><div className="product-grid">{products.map((product, index) => <Reveal key={`${product.code || "product"}-${index}`}><ProductCard product={product} copy={copy} language={language} checkoutLoading={checkoutLoading} onSubscribe={subscribe} /></Reveal>)}</div></>
          )}
        </section>
      </section>
      <section id="how-it-works" className="page-width how-section"><Reveal><p className="eyebrow">{copy.navHow}</p><h2>{copy.howTitle}</h2><div className="steps-grid">{[{ title: copy.howStepOne, text: copy.howTextOne }, { title: copy.howStepTwo, text: copy.howTextTwo }, { title: copy.howStepThree, text: copy.howTextThree }].map((step, index) => <div className="how-step" key={step.title}><div className="step-top"><span>0{index + 1}</span><span className="step-rule" aria-hidden="true" /></div><h3>{step.title}</h3><p>{step.text}</p></div>)}</div></Reveal></section>
      <section className="page-width"><Reveal className="premium-section"><div><p className="eyebrow">FoodFinder {copy.premium}</p><h2>{copy.premiumTitle}</h2><p>{copy.premiumNote}</p></div>{subscription?.isActive ? <span className="subscription-status"><CheckIcon/>{copy.subscriptionActive}</span> : <button type="button" className="button button-forest" disabled={checkoutLoading} onClick={() => void subscribe()}>{checkoutLoading ? copy.subscriptionProcessing : copy.subscribe}<ArrowIcon/></button>}{checkoutError && <p role="alert" className="premium-error">{copy.subscriptionError}</p>}</Reveal></section>
      <footer className="page-width site-footer"><div className="footer-top"><a href="#top" aria-label={copy.appName}><Brand/></a><p>{copy.footerNote}</p><a href="#top" className="back-top">{copy.backTop} <span aria-hidden="true">↑</span></a></div><div className="footer-bottom"><p>{copy.dataNote}</p><span>{copy.demoLabel}</span></div></footer>
    </main>
  );
}
