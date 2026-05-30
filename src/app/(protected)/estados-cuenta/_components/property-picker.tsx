"use client";

import { useEffect, useRef, useState } from "react";

interface PropertyResult {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
  referenceCode: string | null;
}

interface Props {
  value: string | null;
  label: string | null;
  onChange: (id: string | null, label: string | null) => void;
}

const inputClass =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none";

export function PropertyPicker({ value, label, onChange }: Readonly<Props>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PropertyResult[]>([]);
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
    if (value) return; // ya hay una propiedad elegida
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/propiedades?q=${encodeURIComponent(q)}&limit=8`, { cache: "no-store" });
        const body = await res.json();
        if (active) setResults((body?.data ?? []) as PropertyResult[]);
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
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-olive-vivid">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-sm text-text">{label ?? "Propiedad seleccionada"}</span>
        <button
          type="button"
          onClick={() => {
            onChange(null, null);
            setQuery("");
          }}
          aria-label="Quitar propiedad"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-surface hover:text-text"
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
        placeholder="Buscar por dirección, zona o código…"
        className={inputClass}
      />
      {open && (query.trim().length >= 2 || loading) && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-xl">
          {loading ? (
            <p className="px-3 py-2 text-xs text-text-faint">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-faint">Sin resultados.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id, p.address);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-bg/60"
              >
                <span className="block truncate text-sm text-text">{p.address}</span>
                <span className="block truncate text-[11px] text-text-muted">
                  {[p.zone, p.city].filter(Boolean).join(" · ") || p.referenceCode || "—"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
