"use client";

import { useEffect, useState } from "react";
import { loadProductImage } from "@/lib/loadProductImage";

type ProductImageProps = { src: string | null; alt: string; unavailableLabel: string };

export function ProductImage({ src, alt, unavailableLabel }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [download, setDownload] = useState<{ src: string; url: string } | null>(null);
  const failed = !src || failedSrc === src;
  const loaded = Boolean(src && loadedSrc === src);

  useEffect(() => {
    if (!src) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void loadProductImage(src, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setDownload({ src, url: objectUrl });
    }).catch(() => {
      if (!controller.signal.aborted) setFailedSrc(src);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return (
    <div className="relative grid h-52 place-items-center overflow-hidden bg-[#edf0e8] px-6 text-center text-sm text-[var(--muted)]" aria-busy={Boolean(src && !loaded && !failed)}>
      <div className={failed ? "opacity-100" : "animate-pulse opacity-70"}>
        <span className="mx-auto mb-3 block size-10 rounded-full border border-[#c9d0c6] bg-white" aria-hidden="true" />
        {failed ? unavailableLabel : null}
      </div>
      {src && !failed && download?.src === src ? (
        // Open Food Facts image hosts and paths are community-controlled and vary by record.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={download.url}
          alt={alt}
          className={`absolute inset-0 h-full w-full bg-white object-contain p-5 transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="eager"
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
    </div>
  );
}
