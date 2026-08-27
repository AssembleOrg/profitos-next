"use client";

import { useRolePreview } from "./role-preview-context";

const ROLE_LABEL: Record<string, string> = {
  user: "agente",
  admin: "admin",
};

export function RolePreviewBanner() {
  const { isPreviewing, previewRole, setPreviewRole } = useRolePreview();
  if (!isPreviewing || !previewRole) return null;

  return (
    <div
      className="sticky top-0 z-50 px-4 pt-2"
      style={{ paddingTop: "calc(var(--safe-top, 0px) + 0.5rem)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full bg-sand-chip px-4 py-2 shadow-sm">
        <p className="text-xs text-text-muted sm:text-sm">
          Vista previa: viendo la app como <strong className="font-semibold">{ROLE_LABEL[previewRole] ?? previewRole}</strong>. Los datos siguen siendo los tuyos.
        </p>
        <button
          type="button"
          onClick={() => setPreviewRole(null)}
          className="shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-bold text-text-muted transition-colors hover:bg-bg"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
