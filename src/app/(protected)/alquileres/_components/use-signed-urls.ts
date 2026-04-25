"use client";

import { useEffect, useState } from "react";

/**
 * Resolves storage paths to signed URLs (1h) hitting /api/alquileres/signed-urls.
 */
export function useSignedUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.slice().sort().join("|");

  useEffect(() => {
    const unique = Array.from(new Set(paths)).filter(Boolean);
    if (unique.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    fetch("/api/alquileres/signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: unique }),
    })
      .then((r) => (r.ok ? r.json() : { urls: {} }))
      .then((b) => {
        if (!cancelled) setUrls(b.urls ?? {});
      })
      .catch(() => {
        if (!cancelled) setUrls({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
