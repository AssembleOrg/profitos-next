"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

interface TimePickerProps {
  /** Si se pasa, se renderiza un input hidden con este name para envíos por FormData. */
  name?: string;
  label?: string;
  /** Valor controlado "HH:mm". */
  value?: string;
  /** Valor inicial "HH:mm" para uso no controlado. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}

function snapMinute(m: string | undefined): string {
  const n = parseInt(m ?? "00", 10);
  const snapped = Math.round((Number.isFinite(n) ? n : 0) / 15) * 15;
  return String(snapped >= 60 ? 0 : snapped).padStart(2, "0");
}

export function TimePicker({ name, label, value, defaultValue, onChange, required }: Readonly<TimePickerProps>) {
  const isControlled = value !== undefined;
  const init = (isControlled ? value : defaultValue) ?? "09:00";
  const [internalHour, setInternalHour] = useState(() => init.split(":")[0] ?? "09");
  const [internalMinute, setInternalMinute] = useState(() => snapMinute(init.split(":")[1]));
  const [open, setOpen] = useState(false);
  // Popup `fixed` para escapar del overflow de modales/scroll.
  const [coords, setCoords] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  const POPOVER_HEIGHT = 250;

  function toggleOpen() {
    const next = !open;
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const flipUp = rect.bottom + POPOVER_HEIGHT > window.innerHeight - 8;
      setCoords(
        flipUp
          ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4 }
          : { left: rect.left, width: rect.width, top: rect.bottom + 4 }
      );
    }
    setOpen(next);
  }

  // En modo controlado la hora/minuto se derivan del prop; en no controlado, del estado.
  const hour = isControlled ? (value?.split(":")[0] ?? "09").padStart(2, "0") : internalHour;
  const minute = isControlled ? snapMinute(value?.split(":")[1]) : internalMinute;
  const currentValue = `${hour}:${minute}`;

  function update(nextHour: string, nextMinute: string) {
    if (!isControlled) {
      setInternalHour(nextHour);
      setInternalMinute(nextMinute);
    }
    onChange?.(`${nextHour}:${nextMinute}`);
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const scrollToSelected = useCallback(() => {
    requestAnimationFrame(() => {
      const hIdx = HOURS.indexOf(hour);
      const mIdx = MINUTES.indexOf(minute);
      if (hourColRef.current && hIdx >= 0) {
        (hourColRef.current.children[hIdx] as HTMLElement)?.scrollIntoView({ block: "center", behavior: "instant" });
      }
      if (minuteColRef.current && mIdx >= 0) {
        (minuteColRef.current.children[mIdx] as HTMLElement)?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
  }, [hour, minute]);

  useEffect(() => {
    if (open) scrollToSelected();
  }, [open, scrollToSelected]);

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">
          {label} {required && "*"}
        </label>
      )}

      {name && <input type="hidden" name={name} value={currentValue} required={required} />}

      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="flex h-11 w-full items-center justify-between rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text transition-colors hover:border-border-strong focus:border-border-strong focus:outline-none"
      >
        <span>{currentValue}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {open && coords && createPortal(
        <div
          ref={popRef}
          style={{ left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
          className="fixed z-[60] min-w-[8rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        >
          <div className="flex">
            <div ref={hourColRef} className="flex-1 overflow-y-auto border-r border-border py-1" style={{ maxHeight: 200 }}>
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => update(h, minute)}
                  className={`flex w-full items-center justify-center py-2 text-sm transition-colors ${
                    h === hour ? "bg-sand-chip font-bold text-text" : "text-text-muted hover:bg-bg hover:text-text"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
            <div ref={minuteColRef} className="flex-1 overflow-y-auto py-1" style={{ maxHeight: 200 }}>
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update(hour, m)}
                  className={`flex w-full items-center justify-center py-2 text-sm transition-colors ${
                    m === minute ? "bg-sand-chip font-bold text-text" : "text-text-muted hover:bg-bg hover:text-text"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-full bg-dark py-2 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
            >
              Listo
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
