import Link from "next/link";
import type { ReactNode } from "react";
import { IconPlus } from "./icons";

export type RentalsTab = "agenda" | "contratos" | "recibos" | "comprobantes";

const TABS: Array<{ key: RentalsTab; label: string; href: string }> = [
  { key: "agenda", label: "Agenda", href: "/alquileres" },
  { key: "contratos", label: "Contratos", href: "/alquileres/contratos" },
  { key: "recibos", label: "Recibos", href: "/alquileres/recibos" },
  { key: "comprobantes", label: "Comprobantes", href: "/alquileres/comprobantes" },
];

/**
 * Encabezado común de Alquileres: título, acción principal y navegación entre
 * las cuatro vistas. Las pestañas son links (cada vista es su propia URL).
 */
export function RentalsHeader({
  tab,
  subtitle,
  pendingProofs = 0,
  action,
}: {
  tab: RentalsTab;
  subtitle?: ReactNode;
  pendingProofs?: number;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-semibold leading-tight text-text md:text-[28px]">Alquileres</h1>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-text-faint">{subtitle}</p>}
        </div>
        {action ?? (
          <Link
            href="/alquileres/contratos/nuevo"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-11 md:px-5 md:text-[13.5px]"
          >
            <IconPlus size={16} className="text-accent" />
            <span className="hidden sm:inline">Nuevo contrato</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        )}
      </div>
      <nav aria-label="Secciones de alquileres" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
        <ul className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <li key={t.key}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] transition-colors sm:px-4 sm:text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                    active ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
                  }`}
                >
                  {t.label}
                  {t.key === "comprobantes" && pendingProofs > 0 && (
                    <span
                      className={`min-w-[18px] rounded-full px-1.5 text-center text-[10.5px] font-bold leading-[18px] ${
                        active ? "bg-accent text-dark" : "bg-clay-chip text-terra"
                      }`}
                      aria-label={`${pendingProofs} por revisar`}
                    >
                      {pendingProofs}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
