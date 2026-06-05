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

  const persist = useCallback(async (next: string[], href: string) => {
    try {
      const res = await fetch("/api/users/favorites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: next }),
      });
      if (!res.ok) throw new Error("Error al guardar");
    } catch {
      // Revertir SOLO este href contra el estado actual (el toggle es su propio
      // inverso), no pisar con un snapshot viejo que podría descartar otro cambio.
      setFavorites((curr) =>
        curr.includes(href) ? curr.filter((h) => h !== href) : [...curr, href]
      );
      toast.error("No se pudieron guardar los favoritos");
    }
  }, []);

  const toggle = useCallback(
    (href: string) => {
      // Update funcional: cada toggle parte del estado más reciente, así dos
      // toggles seguidos no se pisan entre sí.
      setFavorites((curr) => {
        const next = curr.includes(href) ? curr.filter((h) => h !== href) : [...curr, href];
        void persist(next, href);
        return next;
      });
    },
    [persist]
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
