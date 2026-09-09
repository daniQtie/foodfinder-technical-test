// OFF's image server rate-limits bursts. Share two download slots across cards
// and briefly space requests, including when the user starts another search.
let active = 0;
const waiting: Array<() => void> = [];
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function acquire() {
  if (active < 2) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
}

export async function loadProductImage(src: string, signal: AbortSignal): Promise<Blob> {
  await acquire();
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      signal.throwIfAborted();
      try {
        const response = await fetch(src, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          credentials: "omit",
        });
        if (response.ok && response.headers.get("content-type")?.startsWith("image/")) {
          return await response.blob();
        }
        await response.body?.cancel();
        if (response.status !== 429 && response.status < 500) {
          throw new Error("IMAGE_UNAVAILABLE");
        }
      } catch (error) {
        if (signal.aborted || (error instanceof Error && error.message === "IMAGE_UNAVAILABLE")) throw error;
      }
      if (attempt < 2) await pause(2_000 * (attempt + 1));
    }
    throw new Error("IMAGE_DOWNLOAD_FAILED");
  } finally {
    // Keep successful downloads from immediately starting another burst.
    setTimeout(release, 600);
  }
}
