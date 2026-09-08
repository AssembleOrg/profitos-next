"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface AgencyResult {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

interface Props {
  value: string | null;
  label: string | null;
  onChange: (id: string | null, label: string | null) => void;
}

const inputClass =
  "w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none";

/**
 * Buscador de inmobiliarias con debounce (300 ms) contra /api/inmobiliarias.
 * Sin texto muestra las primeras por nombre para poder elegir rápido.
 */
export function AgencyPicker({ value, label, onChange }: Readonly<Props>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AgencyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (value || !open) return; // ya hay una elegida o el dropdown está cerrado
    const q = query.trim();
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ limit: "8" });
        if (q) qs.set("q", q);
        const res = await fetch(`/api/inmobiliarias?${qs.toString()}`, { cache: "no-store" });
        const body = await res.json();
        if (active) setResults((body?.data ?? []) as AgencyResult[]);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, value, open]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-[14px] border border-border bg-bg px-3.5 py-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-olive-light">
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-sm text-text">{label ?? "Inmobiliaria seleccionada"}</span>
        <button
          type="button"
          onClick={() => {
            onChange(null, null);
            setQuery("");
          }}
          aria-label="Quitar inmobiliaria"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-surface hover:text-text"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar inmobiliaria por nombre, dirección o teléfono…"
        className={inputClass}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-[16px] border border-border bg-surface shadow-xl">
          {loading ? (
            <p className="px-3 py-2 text-xs text-text-faint">Buscando…</p>
          ) : results.length === 0 ? (
            <div className="px-3.5 py-2.5">
              <p className="text-xs text-text-faint">Sin resultados.</p>
              <Link
                href="/inmobiliarias"
                className="mt-1 inline-block text-[11.5px] font-bold text-olive-light hover:underline"
              >
                Cargar inmobiliarias →
              </Link>
            </div>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onChange(a.id, a.name);
                  setOpen(false);
                }}
                className="block w-full px-3.5 py-2 text-left transition-colors hover:bg-bg"
              >
                <span className="block truncate text-sm font-semibold text-text">{a.name}</span>
                <span className="block truncate text-[11px] text-text-faint">
                  {[a.address, a.phone].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
