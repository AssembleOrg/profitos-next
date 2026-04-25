"use client";

import { useEffect, useState } from "react";

/**
 * Resolves storage paths to short-lived signed URLs by hitting /api/firmas/signed-urls.
 * Re-runs whenever the set of paths changes (debounced via dependency on the joined string).
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
    fetch("/api/firmas/signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: unique }),
    })
      .then((res) => (res.ok ? res.json() : { urls: {} }))
      .then((body) => {
        if (cancelled) return;
        setUrls(body.urls ?? {});
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
