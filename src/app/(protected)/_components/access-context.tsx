"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPathAllowed } from "@/lib/nav/views";

interface AccessContextValue {
  isAdmin: boolean;
  accessible: Set<string>;
  /** ¿El usuario puede ver/abrir este href de menú? */
  canAccess: (href: string) => boolean;
}

const AccessContext = createContext<AccessContextValue | null>(null);

interface ProviderProps {
  isAdmin: boolean;
  accessibleHrefs: string[];
  children: ReactNode;
}

/**
 * Provee el acceso del usuario a la navegación y bloquea, del lado del cliente,
 * la navegación SPA hacia rutas no permitidas (el bloqueo "duro" por URL directa
 * lo hace el layout en el servidor).
 */
export function AccessProvider({ isAdmin, accessibleHrefs, children }: Readonly<ProviderProps>) {
  const pathname = usePathname();
  const router = useRouter();

  const value = useMemo<AccessContextValue>(() => {
    const accessible = new Set(accessibleHrefs);
    return {
      isAdmin,
      accessible,
      canAccess: (href: string) => isAdmin || accessible.has(href),
    };
  }, [isAdmin, accessibleHrefs]);

  useEffect(() => {
    if (pathname && !isPathAllowed(pathname, value.accessible, value.isAdmin)) {
      router.replace("/dashboard");
    }
  }, [pathname, value, router]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used within AccessProvider");
  return ctx;
}
