"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

interface NavFavoritesContextValue {
  favorites: string[];
  isFavorite: (href: string) => boolean;
  toggle: (href: string) => void;
}

const NavFavoritesContext = createContext<NavFavoritesContextValue | null>(null);

interface ProviderProps {
  initialFavorites: string[];
  children: ReactNode;
}

/**
 * Favoritos del menú, sincronizados por usuario en la DB.
 * Se siembra con los favoritos del usuario (desde el layout) y persiste cada
 * cambio en /api/users/favorites de forma optimista (revierte si falla).
 */
export function NavFavoritesProvider({ initialFavorites, children }: Readonly<ProviderProps>) {
  const [favorites, setFavorites] = useState<string[]>(initialFavorites);

  const persist = useCallback(async (next: string[], prev: string[]) => {
    try {
      const res = await fetch("/api/users/favorites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: next }),
      });
      if (!res.ok) throw new Error("Error al guardar");
    } catch {
      setFavorites(prev); // revertir si falla
      toast.error("No se pudieron guardar los favoritos");
    }
  }, []);

  const toggle = useCallback(
    (href: string) => {
      const prev = favorites;
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      setFavorites(next);
      void persist(next, prev);
    },
    [favorites, persist]
  );

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites]);

  const value = useMemo<NavFavoritesContextValue>(
    () => ({ favorites, isFavorite, toggle }),
    [favorites, isFavorite, toggle]
  );

  return <NavFavoritesContext.Provider value={value}>{children}</NavFavoritesContext.Provider>;
}

export function useNavFavorites() {
  const ctx = useContext(NavFavoritesContext);
  if (!ctx) throw new Error("useNavFavorites must be used within NavFavoritesProvider");
  return ctx;
}
