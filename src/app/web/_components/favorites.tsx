"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { WEB_BASE } from "@/lib/web/format";
import { useAccount } from "./account";
import { IconHeart } from "./icons";
import { track } from "./tracker";

const KEY = "jw-favoritas";
const EVENT = "jw-favoritas-change";
const EMPTY = "";
const INVITED_KEY = "jw-invitado";

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
  const { enabled, visitor, openLogin } = useAccount();
  const toggle = useCallback(() => {
    const next = active ? favorites.filter((key) => key !== propertyKey) : [...favorites, propertyKey];
    try {
      window.localStorage.setItem(KEY, next.join(","));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENT));
    track(active ? "favorite_remove" : "favorite_add", { propertyKey });
    // Una sola invitación por pestaña: se ofrece, no se exige.
    if (!active && enabled && !visitor && !sessionStorage.getItem(INVITED_KEY)) {
      sessionStorage.setItem(INVITED_KEY, "1");
      openLogin("Guardamos esta propiedad. Ingresá para tener tus favoritas en todos tus dispositivos.");
    }
  }, [active, enabled, favorites, openLogin, propertyKey, visitor]);

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
