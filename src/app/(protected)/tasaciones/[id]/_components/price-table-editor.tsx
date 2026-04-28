"use client";

interface Fila {
  unidad: string;
  valor: string;
  observaciones: string;
}

interface Tabla {
  titulo: string;
  filas: Fila[];
}

interface Props {
  tablas: Tabla[];
  onChange: (tablas: Tabla[]) => void;
}

function formatThousands(value: string): string {
  const num = value.replace(/\./g, "").replace(/[^0-9]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("es-AR");
}

function rawNumber(value: string): string {
  return value.replace(/\./g, "").replace(/[^0-9]/g, "");
}

export function PriceTableEditor({ tablas, onChange }: Readonly<Props>) {
  function addTabla() {
    onChange([...tablas, { titulo: "", filas: [{ unidad: "", valor: "", observaciones: "" }] }]);
  }

  function removeTabla(index: number) {
    onChange(tablas.filter((_, i) => i !== index));
  }

  function updateTabla(index: number, field: keyof Tabla, value: string) {
    const next = [...tablas];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  }

  function addFila(tablaIndex: number) {
    const next = [...tablas];
    next[tablaIndex] = {
      ...next[tablaIndex],
      filas: [...next[tablaIndex].filas, { unidad: "", valor: "", observaciones: "" }],
    };
    onChange(next);
  }

  function removeFila(tablaIndex: number, filaIndex: number) {
    const next = [...tablas];
    next[tablaIndex] = {
      ...next[tablaIndex],
      filas: next[tablaIndex].filas.filter((_, i) => i !== filaIndex),
    };
    onChange(next);
  }

  function updateFila(tablaIndex: number, filaIndex: number, field: keyof Fila, value: string) {
    const next = [...tablas];
    const filas = [...next[tablaIndex].filas];
    filas[filaIndex] = { ...filas[filaIndex], [field]: value };
    next[tablaIndex] = { ...next[tablaIndex], filas };
    onChange(next);
  }

  return (
    <div className="space-y-6">
      {tablas.map((tabla, ti) => (
        <div key={ti} className="space-y-3 rounded-xl border border-border bg-bg p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <input
              value={tabla.titulo}
              onChange={(e) => updateTabla(ti, "titulo", e.target.value)}
              placeholder="Ej: Unidades dos ambientes"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
            />
            <button
              onClick={() => removeTabla(ti)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/10"
              title="Eliminar tabla"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>

          {/* Desktop header */}
          <div className="hidden grid-cols-[1fr_1fr_1fr_36px] gap-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted md:grid">
            <span className="px-1">Unidad</span>
            <span className="px-1">Valor (USD)</span>
            <span className="px-1">Observaciones</span>
            <span />
          </div>

          {/* Rows */}
          {tabla.filas.map((fila, fi) => (
            <div key={fi} className="flex flex-col gap-2 border-b border-border/50 pb-3 last:border-0 last:pb-0 md:grid md:grid-cols-[1fr_1fr_1fr_36px] md:items-center md:border-0 md:pb-0">

              {/* Mobile: label + delete en la misma línea */}
              <div className="flex items-center justify-between md:hidden">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Fila {fi + 1}
                </span>
                <button
                  onClick={() => removeFila(ti, fi)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-red-500/10 hover:text-red-400 active:bg-red-500/15"
                  title="Eliminar fila"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <input
                value={fila.unidad}
                onChange={(e) => updateFila(ti, fi, "unidad", e.target.value)}
                placeholder="9°A"
                className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
              />
              <input
                value={formatThousands(fila.valor)}
                onChange={(e) => updateFila(ti, fi, "valor", rawNumber(e.target.value))}
                placeholder="118.000"
                inputMode="numeric"
                className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
              />
              <input
                value={fila.observaciones}
                onChange={(e) => updateFila(ti, fi, "observaciones", e.target.value)}
                placeholder="Cochera"
                className="rounded-md border border-border bg-surface px-2.5 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
              />

              {/* Desktop: delete en la última columna del grid */}
              <button
                onClick={() => removeFila(ti, fi)}
                className="hidden h-9 w-9 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-red-500/10 hover:text-red-400 md:flex"
                title="Eliminar fila"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={() => addFila(ti)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2.5 text-xs text-text-muted hover:border-secondary hover:text-secondary"
          >
            + Agregar fila
          </button>
        </div>
      ))}

      <button
        onClick={addTabla}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-text-muted transition-colors hover:border-secondary hover:text-secondary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Agregar tabla de precios
      </button>
    </div>
  );
}
