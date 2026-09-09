import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("limits simultaneous image downloads and retries a rate-limited response", async () => {
  vi.useFakeTimers();
  let active = 0;
  let peak = 0;
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    calls += 1;
    const call = calls;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 100));
    active -= 1;
    return call === 1
      ? new Response("rate limited", { status: 429 })
      : new Response("image bytes", { headers: { "content-type": "image/jpeg" } });
  }));
  const { loadProductImage } = await import("../lib/loadProductImage");
  const requests = Promise.all(Array.from({ length: 12 }, (_, i) =>
    loadProductImage(`https://static.openfoodfacts.org/${i}.jpg`, new AbortController().signal)));
  await vi.runAllTimersAsync();
  expect(await requests).toHaveLength(12);
  expect(peak).toBe(2);
  expect(calls).toBe(13);
});

it("does not retry a missing image", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => new Response("missing", { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  const { loadProductImage } = await import("../lib/loadProductImage");
  await expect(loadProductImage("https://static.openfoodfacts.org/missing.jpg", new AbortController().signal))
    .rejects.toThrow("IMAGE_UNAVAILABLE");
  await vi.runAllTimersAsync();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
