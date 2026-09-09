import { describe, expect, it, vi } from "vitest";

import { OpenFoodFactsService } from "../src/services/openFoodFacts.service.ts";

describe("OpenFoodFactsService", () => {
  it("reports exhausted timeouts distinctly and allows a later retry", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce(Response.json({ products: [] }));
    const service = new OpenFoodFactsService({ fetcher, wait: vi.fn(async () => undefined) });
    await expect(service.search("milo", "nl")).rejects.toMatchObject({
      status: 504, code: "PRODUCT_SEARCH_TIMEOUT",
    });
    await expect(service.search("milo", "nl")).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does not report malformed upstream JSON as no matching products", async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ error: "unavailable" }));
    const service = new OpenFoodFactsService({ fetcher, wait: vi.fn(async () => undefined) });
    await expect(service.search("milo", "nl")).rejects.toMatchObject({ code: "PRODUCT_SEARCH_FAILED" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries one transient upstream failure before returning products", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ products: [{ code: "3017620422003", product_name: "Nutella" }] }),
      );
    const retryWait = vi.fn(async () => undefined);
    const service = new OpenFoodFactsService({ fetcher, wait: retryWait });

    await expect(service.search("nutella", "en")).resolves.toMatchObject([
      { code: "3017620422003" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(retryWait).toHaveBeenCalledOnce();
  });

  it("does not retry an Open Food Facts rate-limit response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    const service = new OpenFoodFactsService({ fetcher, wait: vi.fn(async () => undefined) });

    await expect(service.search("cereal", "en")).rejects.toMatchObject({
      status: 429,
      code: "PRODUCT_SEARCH_RATE_LIMITED",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retries a malformed transient response once", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 200 }))
      .mockResolvedValueOnce(Response.json({ products: [] }));
    const service = new OpenFoodFactsService({
      fetcher,
      wait: vi.fn(async () => undefined),
    });

    await expect(service.search("cereal", "en")).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caches successful repeated searches without another upstream request", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ products: [{ code: "3017620422003", product_name: "Nutella" }] }),
    );
    const service = new OpenFoodFactsService({ fetcher, cacheTtlMs: 60_000 });

    await service.search("Nutella", "en");
    await service.search("  nutella  ", "en");

    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("deduplicates simultaneous searches for the same query", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const service = new OpenFoodFactsService({ fetcher });

    const first = service.search("cereal", "en");
    const second = service.search("cereal", "en");
    resolveResponse?.(Response.json({ products: [] }));

    await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("sends a canonical keyword query without requesting the unused total count", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ products: [] }));
    const service = new OpenFoodFactsService({ fetcher });
    await service.search("  Crème   BRÛLÉE ", "fr");
    const url = new URL(fetcher.mock.calls[0]![0] as URL);
    expect(url.pathname).toBe("/cgi/search.pl");
    expect(url.searchParams.get("search_terms")).toBe("crème brûlée");
    expect(url.searchParams.get("no_count")).toBe("1");
    expect(url.searchParams.get("page_size")).toBe("12");
    expect(url.searchParams.get("lc")).toBe("fr");
    expect(url.searchParams.get("nocache")).toBeNull();
  });

  it("returns recent saved results immediately during a single background refresh", async () => {
    let now = 0;
    let finishRefresh!: (response: Response) => void;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ products: [{ code: "old" }] }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishRefresh = resolve; }));
    const service = new OpenFoodFactsService({ fetcher, now: () => now, cacheTtlMs: 100, cacheMaxAgeMs: 1_000 });
    await service.search("cheese", "nl");
    now = 150;
    await expect(service.search("Cheese", "nl")).resolves.toEqual([{ code: "old" }]);
    await expect(service.search("cheese", "nl")).resolves.toEqual([{ code: "old" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    finishRefresh(Response.json({ products: [{ code: "new" }] }));
    await vi.waitFor(async () => {
      expect(await service.search("cheese", "nl")).toEqual([{ code: "new" }]);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps saved results through a failed refresh and cools down before retrying", async () => {
    let now = 0;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ products: [{ code: "cheese" }] }))
      .mockRejectedValue(new TypeError("fetch failed"));
    const service = new OpenFoodFactsService({ fetcher, now: () => now, cacheTtlMs: 100, cacheMaxAgeMs: 120_000, wait: vi.fn(async () => undefined) });
    await service.search("cheese", "nl");
    now = 150;
    await expect(service.search("cheese", "nl")).resolves.toEqual([{ code: "cheese" }]);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    now = 1_000;
    await expect(service.search("cheese", "nl")).resolves.toEqual([{ code: "cheese" }]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("never serves saved results beyond the maximum age", async () => {
    let now = 0;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ products: [{ code: "expired" }] }))
      .mockRejectedValue(new TypeError("fetch failed"));
    const service = new OpenFoodFactsService({ fetcher, now: () => now, cacheTtlMs: 100, cacheMaxAgeMs: 1_000, wait: vi.fn(async () => undefined) });
    await service.search("cheese", "nl");
    now = 1_000;
    await expect(service.search("cheese", "nl")).rejects.toMatchObject({ code: "PRODUCT_SEARCH_FAILED" });
  });

  it("honors rate-limit cooldown for new queries while allowing cached searches", async () => {
    let now = 0;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ products: [{ code: "saved" }] }))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "120" } }))
      .mockResolvedValueOnce(Response.json({ products: [] }));
    const service = new OpenFoodFactsService({ fetcher, now: () => now });
    await service.search("cheese", "nl");
    await expect(service.search("cereal", "nl")).rejects.toMatchObject({ status: 429 });
    now = 60_001;
    await expect(service.search("milo", "nl")).rejects.toMatchObject({ status: 429 });
    await expect(service.search("cheese", "nl")).resolves.toEqual([{ code: "saved" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    now = 120_001;
    await expect(service.search("milo", "nl")).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("keeps language-specific searches separate", async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ products: [] }));
    const service = new OpenFoodFactsService({ fetcher });
    await service.search("cheese", "nl");
    await service.search("cheese", "fr");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
