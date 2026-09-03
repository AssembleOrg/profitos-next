"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { EntryType } from "@/lib/account";
import { SelectField } from "@/components/ui/select-field";
import { Sheet } from "../../_components/sheet";
import type { SerializedCategory } from "./estados-cuenta-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: SerializedCategory[];
  isAdmin: boolean;
}

const inputClass =
  "w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:border-border-strong focus:outline-none";

export function CategoryManagerModal({ open, onOpenChange, categories, isAdmin }: Readonly<Props>) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EntryType>("income");
  const [color, setColor] = useState("#10b981");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) {
      toast.error("Escribí un nombre");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/estados-cuenta/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kind, color }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success("Categoría creada");
      setName("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  async function rename(cat: SerializedCategory) {
    const next = window.prompt("Nuevo nombre", cat.name)?.trim();
    if (!next || next === cat.name) return;
    try {
      const res = await fetch(`/api/estados-cuenta/categorias/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success("Categoría actualizada");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar");
    }
  }

  async function remove(cat: SerializedCategory) {
    if (!confirm(`¿Borrar la categoría "${cat.name}"? Si tiene movimientos, se archivará.`)) return;
    try {
      const res = await fetch(`/api/estados-cuenta/categorias/${cat.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success(body?.message ?? "Categoría borrada");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar");
    }
  }

  const income = categories.filter((c) => c.kind === "income");
  const expense = categories.filter((c) => c.kind === "expense");

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title="Categorías"
      maxWidth="sm:max-w-[560px]"
    >
                <div>
                  {/* Alta */}
                  <div className="mb-5 flex flex-wrap items-end gap-2 rounded-[16px] bg-bg p-3">
                    <div className="flex-1 min-w-[140px]">
                      <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Nueva categoría</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
                        placeholder="Ej. Honorarios, Combustible…"
                        className={inputClass}
                      />
                    </div>
                    <SelectField value={kind} onChange={(e) => setKind(e.target.value as EntryType)} wrapperClassName="w-auto">
                      <option value="income">Ingreso</option>
                      <option value="expense">Egreso</option>
                    </SelectField>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-[42px] w-12 cursor-pointer rounded-[14px] border border-border bg-surface"
                      aria-label="Color"
                    />
                    <button
                      type="button"
                      onClick={add}
                      disabled={busy}
                      className="inline-flex h-[42px] items-center rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      Agregar
                    </button>
                  </div>

                  {/* Listas */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <CategoryColumn title="Ingresos" items={income} isAdmin={isAdmin} onRename={rename} onRemove={remove} />
                    <CategoryColumn title="Egresos" items={expense} isAdmin={isAdmin} onRename={rename} onRemove={remove} />
                  </div>
                </div>
    </Sheet>
  );
}

function CategoryColumn({
  title,
  items,
  isAdmin,
  onRename,
  onRemove,
}: Readonly<{
  title: string;
  items: SerializedCategory[];
  isAdmin: boolean;
  onRename: (c: SerializedCategory) => void;
  onRemove: (c: SerializedCategory) => void;
}>) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">{title}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? "#64748b" }} />
            <span className="min-w-0 flex-1 truncate text-sm text-text">{c.name}</span>
            {c.isSystem ? (
              <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-faint">
                Sistema
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRename(c)}
                  aria-label="Renombrar"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-bg hover:text-text"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onRemove(c)}
                    aria-label="Borrar"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-clay-chip hover:text-terra"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-text-faint">Sin categorías.</p>}
      </div>
    </div>
  );
}
