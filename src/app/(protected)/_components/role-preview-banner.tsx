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
      className="sticky top-0 z-50 border-b border-olive-bright/30 bg-olive-deep/95 backdrop-blur"
      style={{ paddingTop: "var(--safe-top, 0px)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <p className="text-xs text-accent sm:text-sm">
          Vista previa: viendo la app como <strong className="font-semibold">{ROLE_LABEL[previewRole] ?? previewRole}</strong>. Los datos siguen siendo los tuyos.
        </p>
        <button
          type="button"
          onClick={() => setPreviewRole(null)}
          className="shrink-0 rounded-md border border-olive-bright/40 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-olive-mid/30"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
