"use client";

import { useRolePreview, type Role } from "../_components/role-preview-context";
import { useAccess } from "../_components/access-context";
import { AccessManager } from "./_components/access-manager";

const OPTIONS: { value: Role | null; label: string; description: string }[] = [
  { value: null, label: "Real (admin)", description: "Tu rol actual, sin filtros aplicados." },
  { value: "user", label: "Agente", description: "Cómo verá la app un empleado." },
];

export default function ConfiguracionPage() {
  const { previewRole, setPreviewRole } = useRolePreview();
  const { isAdmin } = useAccess();

  return (
    <div className="flex flex-col gap-6 py-2">
      <section>
        <h1 className="text-lg font-medium text-text">Configuración</h1>
        <p className="mt-1 text-sm text-text-muted">Preferencias de tu cuenta.</p>
      </section>

      {isAdmin && <AccessManager />}

      <section className="rounded-2xl border border-border bg-surface/60 p-5">
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-text">Vista previa de roles</h2>
          <p className="mt-1 text-xs text-text-muted">
            Cambiá entre roles para revisar qué secciones del menú verá cada perfil. Los datos que se muestran siguen
            siendo los tuyos — esto sirve para validar qué tendrán disponible los empleados.
          </p>
        </header>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((opt) => {
            const active = previewRole === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setPreviewRole(opt.value)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-olive-bright/50 bg-olive-deep/60"
                    : "border-border bg-surface-elevated/40 hover:bg-surface-elevated"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-olive-bright bg-olive-bright" : "border-border-strong"
                  }`}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-bg" />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className={`text-sm font-medium ${active ? "text-accent" : "text-text"}`}>{opt.label}</span>
                  <span className="text-xs text-text-muted">{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
