"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { formatARS } from "@/lib/rentals";
import { CurrencyInput } from "../../alquileres/_components/currency-input";

export interface SerializedAdditional {
  id: string;
  name: string;
  defaultAmount: number | null;
  notes: string | null;
  contractsCount: number;
}

interface AdicionalesClientProps {
  initialItems: SerializedAdditional[];
}

export function AdicionalesClient({ initialItems }: Readonly<AdicionalesClientProps>) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<SerializedAdditional | null>(null);
  const [open, setOpen] = useState(false);

  async function handleDelete(item: SerializedAdditional) {
    if (item.contractsCount > 0) {
      toast.error("No podés eliminar un adicional que está en uso");
      return;
    }
    if (!confirm(`¿Eliminar el adicional "${item.name}"?`)) return;
    try {
      const res = await fetch(`/api/adicionales/${item.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Adicional eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Adicionales</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            Catálogo de conceptos que se suman a las cuotas (expensas, ABL, wifi, services, etc.).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
        >
          <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo adicional
        </button>
      </header>

      {items.length === 0 ? (
        <p className="rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
          Todavía no hay adicionales cargados.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {items.map((it) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-text">{it.name}</h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${it.contractsCount > 0 ? "bg-sage-chip text-olive-light" : "bg-bg text-text-faint"}`}>
                    {it.contractsCount} en uso
                  </span>
                </div>
                {it.defaultAmount !== null && (
                  <p className="text-xs text-text-muted">
                    Default: <span className="font-display font-bold text-text">{formatARS(it.defaultAmount)}</span>
                  </p>
                )}
                {it.notes && (
                  <p className="text-xs text-text-faint line-clamp-2">{it.notes}</p>
                )}
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(it);
                      setOpen(true);
                    }}
                    className="rounded-full bg-bg px-4 py-2 text-[12px] font-semibold text-text-muted transition-colors hover:text-text"
                  >
                    Editar
                  </button>
                  {it.contractsCount === 0 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(it)}
                      className="rounded-full bg-clay-chip px-4 py-2 text-[12px] font-bold text-terra transition-opacity hover:opacity-80"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AdditionalFormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
        editing={editing}
        onSaved={(saved) => {
          setItems((prev) => {
            const idx = prev.findIndex((i) => i.id === saved.id);
            if (idx === -1) return [saved, ...prev];
            const next = [...prev];
            next[idx] = saved;
            return next;
          });
        }}
      />
    </div>
  );
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SerializedAdditional | null;
  onSaved: (item: SerializedAdditional) => void;
}

function AdditionalFormDialog({ open, onOpenChange, editing, onSaved }: Readonly<FormDialogProps>) {
  const [name, setName] = useState("");
  const [defaultAmount, setDefaultAmount] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset del form al abrir (antes se hacía en onOpenChange de Radix).
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDefaultAmount(editing?.defaultAmount ?? null);
    setNotes(editing?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Falta el nombre");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        defaultAmount,
        notes: notes.trim() || null,
      };
      const res = await fetch(editing ? `/api/adicionales/${editing.id}` : "/api/adicionales", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onSaved({
        id: body.data.id,
        name: body.data.name,
        defaultAmount: body.data.defaultAmount,
        notes: body.data.notes,
        contractsCount: editing?.contractsCount ?? 0,
      });
      toast.success(editing ? "Adicional actualizado" : "Adicional creado");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title={editing ? "Editar adicional" : "Nuevo adicional"}
      maxWidth="sm:max-w-[480px]"
      footer={
        <>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-2 text-[13px] font-semibold text-text-faint transition-colors hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
          </button>
        </>
      }
    >
                <div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Expensas, ABL, Wifi…"
                        className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Importe sugerido <span className="text-text-faint">(opcional)</span>
                      </label>
                      <CurrencyInput
                        value={defaultAmount}
                        onChange={setDefaultAmount}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Notas <span className="text-text-faint">(opcional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:border-border-strong focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
    </Sheet>
  );
}
