"use client";

import { useEffect, useState } from "react";

/**
 * Resolves storage paths to short-lived signed URLs by hitting /api/firmas/signed-urls.
 * Re-runs whenever the set of paths changes (debounced via dependency on the joined string).
 */
export function useSignedUrls(paths: string[]): { urls: Record<string, string>; loading: boolean } {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const key = paths.slice().sort().join("|");

  useEffect(() => {
    const unique = Array.from(new Set(paths)).filter(Boolean);
    if (unique.length === 0) {
      setUrls({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { urls, loading };
}
