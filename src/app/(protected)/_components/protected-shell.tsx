"use client";

import type { ReactNode } from "react";
import { Sidebar } from "../dashboard/_components/sidebar";
import { CommandPalette } from "../dashboard/_components/command-palette";
import { BottomNav } from "./bottom-nav";
import { RolePreviewProvider, useRolePreview, type Role } from "./role-preview-context";
import { RolePreviewBanner } from "./role-preview-banner";

interface ProtectedShellProps {
  realRole: Role;
  avatarUrl: string | null;
  greeting: ReactNode;
  children: ReactNode;
}

function Shell({ avatarUrl, greeting, children }: Omit<ProtectedShellProps, "realRole">) {
  const { effectiveRole } = useRolePreview();
  return (
    <>
      <Sidebar avatarUrl={avatarUrl} role={effectiveRole} />
      <main className="flex-1 overflow-auto transition-[margin] duration-200 md:ml-[var(--sidebar-width,13rem)]">
        <RolePreviewBanner />
        <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-5">
          {greeting}
          <CommandPalette role={effectiveRole} />
        </header>
        <div className="px-5 pb-nav md:px-8 md:pb-8">{children}</div>
      </main>
      <BottomNav role={effectiveRole} />
    </>
  );
}

export function ProtectedShell({ realRole, avatarUrl, greeting, children }: ProtectedShellProps) {
  return (
    <RolePreviewProvider realRole={realRole}>
      <Shell avatarUrl={avatarUrl} greeting={greeting}>
        {children}
      </Shell>
    </RolePreviewProvider>
  );
}
