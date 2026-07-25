"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DateTime, Info } from "luxon";

interface DateFieldProps {
  /** ISO date string (YYYY-MM-DD) o "" */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Mostrar botón "limpiar" cuando hay valor. */
  clearable?: boolean;
  /** ID html opcional para asociar a label. */
  id?: string;
}

const TIMEZONE = "America/Argentina/Buenos_Aires";

/* ──────────────────────────────────────────────────────────────────
 *  Helpers DD/MM/YYYY ↔ ISO
 * ──────────────────────────────────────────────────────────────── */

/** Aplica máscara mientras el usuario tipea: "15052026" → "15/05/2026". */
function applyMask(raw: string): string {
  const digits = raw.replaceAll(/\D/g, "").slice(0, 8);
  let out = "";
  if (digits.length === 0) return "";
  out += digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4, 8);
  return out;
}

/** "DD/MM/YYYY" válido → ISO "YYYY-MM-DD". Si no es válido, devuelve "". */
function visualToIso(visual: string): string {
  const trimmed = visual.trim();
  if (trimmed.length !== 10) return "";
  const dt = DateTime.fromFormat(trimmed, "dd/MM/yyyy", { zone: TIMEZONE });
  return dt.isValid ? (dt.toISODate() ?? "") : "";
}

/** ISO "YYYY-MM-DD" → "DD/MM/YYYY" para mostrar en el input. */
function isoToVisual(iso: string): string {
  if (!iso) return "";
  const dt = DateTime.fromISO(iso, { zone: TIMEZONE });
  return dt.isValid ? dt.toFormat("dd/MM/yyyy") : "";
}

/* ──────────────────────────────────────────────────────────────────
 *  Componente principal
 * ──────────────────────────────────────────────────────────────── */

export function DateField({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled,
  className,
  clearable = true,
  id,
}: Readonly<DateFieldProps>) {
  const [text, setText] = useState<string>(() => isoToVisual(value));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync cuando el value cambia desde fuera (reset, prefill, etc.)
  useEffect(() => {
    setText(isoToVisual(value));
  }, [value]);

  // Click outside cierra el popover
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleTextChange(raw: string) {
    const masked = applyMask(raw);
    setText(masked);
    if (masked.length === 10) {
      const iso = visualToIso(masked);
      if (iso) onChange(iso);
    } else if (masked === "") {
      onChange("");
    }
  }

  function handleBlur() {
    if (!text) {
      if (value !== "") onChange("");
      return;
    }
    const iso = visualToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToVisual(iso));
    } else {
      // restaurar al último válido
      setText(isoToVisual(value));
    }
  }

  function handleClear() {
    setText("");
    onChange("");
    setOpen(false);
  }

  function handleSelectDay(iso: string) {
    onChange(iso);
    setText(isoToVisual(iso));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-center rounded-xl border border-border bg-bg focus-within:border-secondary">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="h-10 flex-1 rounded-l-xl bg-transparent px-3 text-sm tabular-nums text-text placeholder:text-text-faint focus:outline-none disabled:opacity-50"
        />
        {clearable && text && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar fecha"
            className="flex h-9 w-7 items-center justify-center text-text-faint transition-colors hover:text-danger"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-label="Abrir calendario"
          className={`flex h-9 w-9 items-center justify-center rounded-r-xl text-text-muted transition-colors hover:text-text disabled:opacity-50 ${open ? "text-accent" : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 z-50 mt-2 w-[280px] origin-top-right overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl"
          >
            <CalendarPopover value={value} onSelect={handleSelectDay} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 *  Calendar mini (popover content)
 * ──────────────────────────────────────────────────────────────── */

interface CalendarPopoverProps {
  value: string;
  onSelect: (iso: string) => void;
}

function CalendarPopover({ value, onSelect }: Readonly<CalendarPopoverProps>) {
  const today = DateTime.now().setZone(TIMEZONE).startOf("day");
  const initial = value
    ? DateTime.fromISO(value, { zone: TIMEZONE }).startOf("month")
    : today.startOf("month");
  const [cursor, setCursor] = useState<DateTime>(initial);

  const weekdays = Info.weekdays("narrow", { locale: "es" });
  // Luxon: Monday = 1, Sunday = 7. Reordeno para que arranque en lunes.
  const startWeekday = cursor.weekday; // 1..7 (Mon=1)
  const daysInMonth = cursor.daysInMonth ?? 30;
  const cells: Array<{ day: number; iso: string; thisMonth: boolean }> = [];

  // Días del mes anterior para llenar la primera fila
  const prevMonth = cursor.minus({ months: 1 });
  const daysInPrev = prevMonth.daysInMonth ?? 30;
  for (let i = startWeekday - 1; i > 0; i--) {
    const d = daysInPrev - i + 1;
    const dt = prevMonth.set({ day: d });
    cells.push({ day: d, iso: dt.toISODate() ?? "", thisMonth: false });
  }
  // Días del mes actual
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = cursor.set({ day: d });
    cells.push({ day: d, iso: dt.toISODate() ?? "", thisMonth: true });
  }
  // Días del mes siguiente para completar el grid (42 celdas = 6 filas)
  while (cells.length < 42) {
    const idx = cells.length - daysInMonth - (startWeekday - 1) + 1;
    const dt = cursor.plus({ months: 1 }).set({ day: idx });
    cells.push({ day: idx, iso: dt.toISODate() ?? "", thisMonth: false });
  }

  const monthLabel = cursor.toFormat("MMMM yyyy", { locale: "es" });

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setCursor((c) => c.minus({ months: 1 }))}
          aria-label="Mes anterior"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-xs font-semibold capitalize text-text">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setCursor((c) => c.plus({ months: 1 }))}
          aria-label="Mes siguiente"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-px px-2 pt-2 text-center">
        {weekdays.map((w) => (
          <span key={w} className="text-[10px] font-medium uppercase tracking-wider text-text-faint">
            {w}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 px-2 py-2">
        {cells.map((cell) => {
          const isSelected = value && cell.iso === value;
          const isToday = cell.iso === today.toISODate();
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className={`flex h-8 items-center justify-center rounded-md text-xs tabular-nums transition-colors ${
                isSelected
                  ? "bg-olive-mid font-semibold text-bg"
                  : isToday
                    ? "border border-olive-bright/40 text-accent hover:bg-olive-subtle"
                    : cell.thisMonth
                      ? "text-text hover:bg-bg"
                      : "text-text-faint hover:bg-bg/50"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* Hoy shortcut */}
      <div className="flex justify-center border-t border-border bg-bg/30 py-2">
        <button
          type="button"
          onClick={() => onSelect(today.toISODate() ?? "")}
          className="rounded-md px-3 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-bg hover:text-text"
        >
          Hoy
        </button>
      </div>
    </div>
  );
}
