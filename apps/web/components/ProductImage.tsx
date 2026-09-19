"use client";

import { useEffect, useState } from "react";
import { loadProductImage } from "@/lib/loadProductImage";
import type { Messages } from "@/lib/i18n";
import { PackageIcon } from "./icons";

type ProductImageProps = { src: string | null; alt: string; copy: Messages };

export function ProductImage({ src, alt, copy }: ProductImageProps) {
  const [attempt, setAttempt] = useState(0);
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
  }, [src, attempt]);

  return (
    <div className="product-image" aria-busy={Boolean(src && !loaded && !failed)}>
      {!loaded && <div className={`image-placeholder ${!failed ? "animate-pulse" : ""}`}><PackageIcon/><span>{!src ? copy.noImage : failed ? copy.imageFailed : copy.imageLoading}</span>{src && failed && <button className="image-retry" type="button" onClick={() => { setFailedSrc(null); setLoadedSrc(null); setDownload(null); setAttempt((value) => value + 1); }}>{copy.retryImage}</button>}</div>}
      {src && !failed && download?.src === src ? (
        // Open Food Facts image hosts and paths are community-controlled and vary by record.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={download.url}
          alt={alt}
          className={loaded ? "opacity-100" : "opacity-0"}
          loading="eager"
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
    </div>
  );
}
