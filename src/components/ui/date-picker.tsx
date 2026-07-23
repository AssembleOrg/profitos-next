"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime, formatDate } from "@/lib/datetime";

// Encabezados de la grilla, semana empezando en lunes (formato AR/ES).
const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

interface DatePickerProps {
  /** Valor controlado en ISO "YYYY-MM-DD" (o "" / null si vacío). */
  value?: string | null;
  /** Valor inicial en ISO para uso no controlado. */
  defaultValue?: string;
  /** Se dispara con el ISO "YYYY-MM-DD" elegido (o "" al limpiar). */
  onChange?: (iso: string) => void;
  /** Si se pasa, se renderiza un input hidden con este name para envíos por FormData. */
  name?: string;
  placeholder?: string;
  /** Clases del botón disparador. */
  className?: string;
  required?: boolean;
  disabled?: boolean;
  /** Límites opcionales (ISO YYYY-MM-DD). */
  min?: string;
  max?: string;
  id?: string;
  "aria-label"?: string;
}

const DEFAULT_TRIGGER =
  "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors hover:border-secondary focus:border-secondary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export function DatePicker({
  value,
  defaultValue,
  onChange,
  name,
  placeholder = "DD/MM/AAAA",
  className,
  required,
  disabled,
  min,
  max,
  id,
  "aria-label": ariaLabel,
}: Readonly<DatePickerProps>) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const current = (isControlled ? value ?? "" : internal).slice(0, 10);

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<DateTime>(() =>
    (current ? DateTime.fromISO(current) : DateTime.now()).startOf("month")
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Al abrir, posicionar el calendario en el mes del valor actual.
  function toggleOpen() {
    const next = !open;
    if (next) setViewMonth((current ? DateTime.fromISO(current) : DateTime.now()).startOf("month"));
    setOpen(next);
  }

  // Cerrar al hacer click afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const todayIso = DateTime.now().toISODate() ?? "";

  const cells = useMemo(() => {
    const first = viewMonth.startOf("month");
    const daysInMonth = viewMonth.daysInMonth ?? 30;
    const leading = first.weekday - 1; // luxon: 1=lunes … 7=domingo
    const out: (string | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(first.set({ day: d }).toISODate());
    }
    return out;
  }, [viewMonth]);

  function commit(iso: string) {
    if (!isControlled) setInternal(iso);
    onChange?.(iso);
  }

  function pick(iso: string) {
    commit(iso);
    setOpen(false);
  }

  function isDisabledDay(iso: string): boolean {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  const monthLabel = viewMonth.setLocale("es").toFormat("LLLL yyyy");
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <div className="relative" ref={containerRef}>
      {name && <input type="hidden" name={name} value={current} required={required} />}

      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggleOpen}
        className={className ? `flex w-full items-center justify-between gap-2 ${className}` : DEFAULT_TRIGGER}
      >
        <span className={current ? "text-text" : "text-text-muted/60"}>
          {current ? formatDate(current) : placeholder}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[17rem] overflow-hidden rounded-xl border border-border bg-surface p-3 shadow-xl">
          {/* Cabecera: navegación de mes */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => m.minus({ months: 1 }))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg hover:text-text"
              aria-label="Mes anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="text-sm font-semibold text-text">{monthLabelCap}</span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => m.plus({ months: 1 }))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg hover:text-text"
              aria-label="Mes siguiente"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {/* Encabezados de días */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-center text-[10px] font-semibold uppercase text-text-faint">
                {w}
              </div>
            ))}
          </div>

          {/* Grilla de días */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`b${i}`} />;
              const day = Number(iso.slice(8, 10));
              const isSelected = iso === current;
              const isToday = iso === todayIso;
              const off = isDisabledDay(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={off}
                  onClick={() => pick(iso)}
                  className={`flex h-8 items-center justify-center rounded-lg text-sm transition-colors ${
                    isSelected
                      ? "bg-secondary/25 font-semibold text-secondary"
                      : isToday
                        ? "font-semibold text-secondary hover:bg-bg"
                        : "text-text hover:bg-bg"
                  } ${off ? "cursor-not-allowed opacity-30 hover:bg-transparent" : ""}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Acciones */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => pick(todayIso)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-secondary transition-colors hover:bg-secondary/15"
            >
              Hoy
            </button>
            {!required && (
              <button
                type="button"
                onClick={() => {
                  commit("");
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-bg hover:text-text"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
