"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

interface TimePickerProps {
  name: string;
  label: string;
  defaultValue?: string; // "HH:mm"
  required?: boolean;
}

export function TimePicker({ name, label, defaultValue, required }: TimePickerProps) {
  const [hour, setHour] = useState(() => defaultValue?.split(":")[0] ?? "09");
  const [minute, setMinute] = useState(() => {
    const m = defaultValue?.split(":")[1] ?? "00";
    // snap to nearest 15-min slot
    const n = parseInt(m, 10);
    const snapped = Math.round(n / 15) * 15;
    return String(snapped >= 60 ? 0 : snapped).padStart(2, "0");
  });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  const value = `${hour}:${minute}`;

  // Close on outside click
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

  // Scroll to selected values when opening
  const scrollToSelected = useCallback(() => {
    requestAnimationFrame(() => {
      const hIdx = HOURS.indexOf(hour);
      const mIdx = MINUTES.indexOf(minute);
      if (hourColRef.current && hIdx >= 0) {
        const el = hourColRef.current.children[hIdx] as HTMLElement;
        el?.scrollIntoView({ block: "center", behavior: "instant" });
      }
      if (minuteColRef.current && mIdx >= 0) {
        const el = minuteColRef.current.children[mIdx] as HTMLElement;
        el?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
  }, [hour, minute]);

  useEffect(() => {
    if (open) scrollToSelected();
  }, [open, scrollToSelected]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-xs font-medium text-text-muted">
        {label} {required && "*"}
      </label>

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text transition-colors hover:border-secondary focus:border-secondary focus:outline-none"
      >
        <span>{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex">
            {/* Hours column */}
            <div
              ref={hourColRef}
              className="flex-1 overflow-y-auto border-r border-border py-1"
              style={{ maxHeight: 200 }}
            >
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHour(h)}
                  className={`flex w-full items-center justify-center py-2 text-sm transition-colors ${
                    h === hour
                      ? "bg-secondary/20 font-semibold text-secondary"
                      : "text-text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>

            {/* Minutes column */}
            <div
              ref={minuteColRef}
              className="flex-1 overflow-y-auto py-1"
              style={{ maxHeight: 200 }}
            >
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinute(m)}
                  className={`flex w-full items-center justify-center py-2 text-sm transition-colors ${
                    m === minute
                      ? "bg-secondary/20 font-semibold text-secondary"
                      : "text-text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm */}
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-lg bg-secondary/20 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
