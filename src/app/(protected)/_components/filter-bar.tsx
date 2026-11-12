"use client";

import { useState, type ReactNode } from "react";
import { Sheet } from "./sheet";

/**
 * Barra de filtros (patrón para todas las vistas con filtros).
 * - Siempre: una fila de atajos (chips) que se desliza de costado, nunca baja de renglón.
 * - Celular/tablet: los campos van a una hoja "Filtros" con el contador de activos.
 * - Compu (lg): los mismos campos, en línea debajo de los atajos.
 * Los campos aplican al instante (como hasta ahora); la hoja solo los agrupa.
 */
export function FilterBar({
  chips,
  fields,
  activeCount,
  onClear,
}: Readonly<{
  chips: ReactNode;
  fields: ReactNode;
  activeCount: number;
  onClear?: () => void;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3 lg:rounded-[20px] lg:border lg:border-border lg:bg-surface lg:p-4">
      <div className="flex items-center gap-2">
        <div className="-ml-5 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pl-5 [scrollbar-width:none] md:ml-0 md:pl-0 lg:flex-wrap">
          {chips}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted lg:hidden"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filtros
          {activeCount > 0 && (
            <span className="min-w-[18px] rounded-full bg-dark px-1.5 text-center text-[10.5px] font-bold leading-[18px] text-dark-fg">{activeCount}</span>
          )}
        </button>
      </div>
      {/* Columnas según el ancho (mín. 150px): no corta etiquetas aunque cada vista tenga otra cantidad de campos. */}
      <div className="hidden grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-end gap-3 lg:grid">{fields}</div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        maxWidth="sm:max-w-lg"
        footer={
          <>
            {onClear && activeCount > 0 ? (
              <button type="button" onClick={onClear} className="text-[13px] font-semibold text-text-faint hover:text-text">
                Limpiar filtros
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg"
            >
              Listo
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">{fields}</div>
      </Sheet>
    </section>
  );
}

/** Atajo de la barra (preset). `active` lo marca como el elegido. */
export function FilterChip({ active = false, onClick, children }: Readonly<{ active?: boolean; onClick: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[12.5px] transition-colors ${
        active ? "bg-dark font-bold text-dark-fg" : "border border-border bg-surface font-semibold text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
