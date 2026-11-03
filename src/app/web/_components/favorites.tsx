"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { WEB_BASE } from "@/lib/web/format";
import { IconHeart } from "./icons";

const KEY = "jw-favoritas";
const EVENT = "jw-favoritas-change";
const EMPTY = "";

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function useFavorites(): string[] {
  const raw = useSyncExternalStore(subscribe, read, () => EMPTY);
  return raw ? raw.split(",") : [];
}

export function FavoriteButton({ propertyKey, label }: { propertyKey: string; label: string }) {
  const favorites = useFavorites();
  const active = favorites.includes(propertyKey);
  const toggle = useCallback(() => {
    const next = active ? favorites.filter((key) => key !== propertyKey) : [...favorites, propertyKey];
    try {
      window.localStorage.setItem(KEY, next.join(","));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  }, [active, favorites, propertyKey]);

  return (
    <button
      type="button"
      className="jw-fav"
      data-active={active}
      aria-pressed={active}
      aria-label={active ? `Quitar ${label} de favoritas` : `Guardar ${label} en favoritas`}
      onClick={toggle}
    >
      <IconHeart />
    </button>
  );
}

export function FavoritesLink() {
  const favorites = useFavorites();
  const href = favorites.length ? `${WEB_BASE}/propiedades?ids=${favorites.join(",")}` : `${WEB_BASE}/propiedades`;
  return (
    <Link href={href} className="jw-favlink" aria-label={`Favoritas: ${favorites.length}`}>
      <IconHeart />
      {favorites.length > 0 && <span className="jw-favcount">{favorites.length}</span>}
    </Link>
  );
}
