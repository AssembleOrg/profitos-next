"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { FirmaClient, SerializedFirma } from "./types";
import { serializeFromApi } from "./serialize";

const inputCls =
  "h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none disabled:opacity-50";

/**
 * Comprador / vendedor: busca en Contactos (nombre, teléfono o mail) y, si no
 * está, lo da de alta ahí mismo para que quede vinculado a la base de clientes.
 */
export function PartyPicker({
  label,
  value,
  onChange,
  disabled,
}: Readonly<{
  label: string;
  value: FirmaClient | null;
  onChange: (next: FirmaClient | null) => void;
  disabled?: boolean;
}>) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<FirmaClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const [creating, setCreating] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setSearched("");
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clientes?q=${encodeURIComponent(term)}&limit=8`, { cache: "no-store" });
        const body = await res.json();
        const list = (Array.isArray(body.data) ? body.data : body.data?.items ?? []) as FirmaClient[];
        setItems(list.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null })));
        setSearched(term);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function create() {
    if (!creating?.name.trim()) {
      toast.error(`Escribí el nombre del ${label.toLowerCase()}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creating.name.trim(),
          phone: creating.phone.trim() || undefined,
          email: creating.email.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      const c = body.data as FirmaClient;
      onChange({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null });
      toast.success(`${c.name} quedó guardado en Contactos`);
      setCreating(null);
      setQ("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el contacto");
    } finally {
      setSaving(false);
    }
  }

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">{label}</span>
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-[14px] bg-sand-chip px-3.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-bold text-text">{value.name}</p>
            {(value.phone || value.email) && (
              <p className="truncate text-[11.5px] text-text-muted">{[value.phone, value.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="shrink-0 text-[12.5px] font-bold text-terra transition-opacity hover:opacity-80"
            >
              Cambiar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">{label} · contacto nuevo</span>
        <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-2.5">
          <input
            value={creating.name}
            onChange={(e) => setCreating({ ...creating, name: e.target.value })}
            placeholder="Nombre y apellido *"
            aria-label={`Nombre del ${label.toLowerCase()}`}
            autoFocus
            className={inputCls}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={creating.phone}
              onChange={(e) => setCreating({ ...creating, phone: e.target.value })}
              placeholder="Teléfono"
              inputMode="tel"
              aria-label={`Teléfono del ${label.toLowerCase()}`}
              className={inputCls}
            />
            <input
              value={creating.email}
              onChange={(e) => setCreating({ ...creating, email: e.target.value })}
              placeholder="Email"
              type="email"
              aria-label={`Email del ${label.toLowerCase()}`}
              className={inputCls}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="text-[12.5px] font-semibold text-text-faint hover:text-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="h-9 rounded-full bg-dark px-4 text-[12.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar en Contactos"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showEmpty = !loading && searched.length >= 2 && items.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-text-muted">{label}</span>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en Contactos: nombre, teléfono o mail"
          aria-label={`Buscar ${label.toLowerCase()}`}
          disabled={disabled}
          className={inputCls}
        />
        {(items.length > 0 || loading || showEmpty) && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-[14px] border border-border bg-surface p-1 shadow-2xl">
            {loading && items.length === 0 && <p className="px-3 py-2 text-[12px] text-text-faint">Buscando…</p>}
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c);
                  setQ("");
                  setItems([]);
                }}
                className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-colors hover:bg-bg"
              >
                <span className="line-clamp-1 text-[13.5px] font-bold text-text">{c.name}</span>
                {(c.phone || c.email) && (
                  <span className="line-clamp-1 text-[11.5px] text-text-faint">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                )}
              </button>
            ))}
            {showEmpty && <p className="px-3 py-2 text-[12px] text-text-faint">No está en Contactos.</p>}
            {!loading && searched.length >= 2 && (
              <button
                type="button"
                onClick={() => setCreating({ name: q.trim(), phone: "", email: "" })}
                className="w-full rounded-xl px-3 py-2 text-left text-[12.5px] font-bold text-olive-light transition-colors hover:bg-bg"
              >
                + Crear «{q.trim()}» en Contactos
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Detalle de la firma: comprador y vendedor se guardan apenas se eligen. */
export function PartiesPanel({
  firma,
  onUpdated,
}: Readonly<{ firma: SerializedFirma; onUpdated: (firma: SerializedFirma) => void }>) {
  const [busy, setBusy] = useState(false);

  async function save(key: "buyerClientId" | "sellerClientId", next: FirmaClient | null, label: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/firmas/${firma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next?.id ?? null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onUpdated(serializeFromApi(body.data));
      if (next) toast.success(`${label}: ${next.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[16px] border border-border bg-surface p-4">
      <h4 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Comprador y vendedor</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PartyPicker label="Comprador" value={firma.buyer} onChange={(c) => save("buyerClientId", c, "Comprador")} disabled={busy} />
        <PartyPicker label="Vendedor" value={firma.seller} onChange={(c) => save("sellerClientId", c, "Vendedor")} disabled={busy} />
      </div>
    </section>
  );
}
