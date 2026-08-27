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
        <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Configuración</h1>
        <p className="mt-1 text-[12.5px] text-text-faint">Preferencias de tu cuenta.</p>
      </section>

      {isAdmin && <AccessManager />}

      <section className="rounded-[20px] border border-border bg-surface p-4 md:p-5">
        <header className="mb-3">
          <h2 className="font-display text-base font-semibold text-text">Vista previa de roles</h2>
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
                className={`flex items-start gap-3 rounded-[16px] border p-3.5 text-left transition-colors ${
                  active
                    ? "border-transparent bg-sand-chip"
                    : "border-border bg-surface hover:bg-bg"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-accent bg-accent" : "border-border-strong bg-surface"
                  }`}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-surface" />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className={`text-sm ${active ? "font-bold text-text" : "font-medium text-text"}`}>{opt.label}</span>
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
