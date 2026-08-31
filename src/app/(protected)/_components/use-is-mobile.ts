"use client";

import { useSyncExternalStore } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

function subscribe(onStoreChange: () => void) {
  if (!("window" in globalThis)) return () => {};

  const mql = globalThis.window.matchMedia(MOBILE_MEDIA_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  if (!("window" in globalThis)) return false;
  return globalThis.window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/** true cuando el viewport es mobile (< 640px). SSR-safe. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
