"use client";

import { useCallback, useEffect, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: Updater<T>) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // ignore parse errors, fall back to default
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (next: Updater<T>) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignore quota / private mode
        }
        return resolved;
      });
    },
    [key]
  );

  return [hydrated ? value : defaultValue, update];
}
