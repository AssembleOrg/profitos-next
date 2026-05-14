"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

export type Role = "admin" | "user" | "viewer";
export type PreviewableRole = "user";

interface RolePreviewContextValue {
  realRole: Role;
  effectiveRole: Role;
  previewRole: Role | null;
  isPreviewing: boolean;
  setPreviewRole: (role: Role | null) => void;
}

const RolePreviewContext = createContext<RolePreviewContextValue | null>(null);

interface RolePreviewProviderProps {
  realRole: Role;
  children: ReactNode;
}

export function RolePreviewProvider({ realRole: _realRole, children }: RolePreviewProviderProps) {
  // Fase demo: todos los usuarios Google entran con role "user" en BD, pero conceptualmente operan como admin.
  // Tratamos al usuario como admin de facto hasta que se implementen roles diferenciados.
  const realRole: Role = "admin";

  const [previewRole, setPreviewRoleRaw] = useLocalStorage<Role | null>("jp_preview_role", null);

  const setPreviewRole = useCallback(
    (role: Role | null) => {
      setPreviewRoleRaw(role);
    },
    [setPreviewRoleRaw]
  );

  const value = useMemo<RolePreviewContextValue>(() => {
    const isPreviewing = previewRole !== null && previewRole !== realRole;
    const effective = isPreviewing ? (previewRole as Role) : realRole;
    return {
      realRole,
      effectiveRole: effective,
      previewRole,
      isPreviewing,
      setPreviewRole,
    };
  }, [previewRole, setPreviewRole]);

  return <RolePreviewContext.Provider value={value}>{children}</RolePreviewContext.Provider>;
}

export function useRolePreview() {
  const ctx = useContext(RolePreviewContext);
  if (!ctx) {
    throw new Error("useRolePreview must be used within RolePreviewProvider");
  }
  return ctx;
}
