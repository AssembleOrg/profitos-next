"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";
import { CommandPalette } from "../dashboard/_components/command-palette";
import { BottomNav } from "./bottom-nav";
import { RolePreviewProvider, useRolePreview, type Role } from "./role-preview-context";
import { RolePreviewBanner } from "./role-preview-banner";
import { NavFavoritesProvider } from "./nav-favorites-context";
import { AccessProvider } from "./access-context";
import { NotificationsProvider } from "./notifications-context";

interface ProtectedShellProps {
  realRole: Role;
  avatarUrl: string | null;
  greeting: ReactNode;
  favorites: string[];
  accessibleHrefs: string[];
  isAdmin: boolean;
  children: ReactNode;
}

function Shell({ avatarUrl, greeting, children }: Readonly<Omit<ProtectedShellProps, "realRole" | "favorites" | "accessibleHrefs" | "isAdmin">>) {
  const { effectiveRole } = useRolePreview();
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  return (
    <>
      {/* Desktop: topbar pill flotante */}
      <Topbar avatarUrl={avatarUrl} role={effectiveRole} />

      <main className="flex-1 overflow-auto">
        <RolePreviewBanner />

        {/* Mobile: el saludo solo encabeza el dashboard; el resto de las páginas
            trae su propio título, así que ahí queda únicamente el buscador. */}
        <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-border/70 bg-bg/80 px-5 py-4 backdrop-blur-xl md:hidden">
          {isDashboard && greeting}
          <CommandPalette role={effectiveRole} />
        </header>

        {/* Desktop: saludo solo en dashboard (las demás páginas tienen su propio encabezado) */}
        {isDashboard && (
          <div className="hidden px-6 pt-6 md:block lg:px-10">{greeting}</div>
        )}

        <div className="px-5 pb-nav pt-4 md:px-6 md:pb-10 md:pt-5 lg:px-10">{children}</div>
      </main>
      <BottomNav role={effectiveRole} />
    </>
  );
}

export function ProtectedShell({
  realRole,
  avatarUrl,
  greeting,
  favorites,
  accessibleHrefs,
  isAdmin,
  children,
}: Readonly<ProtectedShellProps>) {
  return (
    <RolePreviewProvider realRole={realRole}>
      <AccessProvider isAdmin={isAdmin} accessibleHrefs={accessibleHrefs}>
        <NavFavoritesProvider initialFavorites={favorites}>
          <NotificationsProvider>
            <Shell avatarUrl={avatarUrl} greeting={greeting}>
              {children}
            </Shell>
          </NotificationsProvider>
        </NavFavoritesProvider>
      </AccessProvider>
    </RolePreviewProvider>
  );
}
