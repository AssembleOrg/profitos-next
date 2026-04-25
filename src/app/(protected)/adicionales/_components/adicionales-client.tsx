"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
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
          <h1 className="font-display text-2xl text-text md:text-3xl">Adicionales</h1>
          <p className="mt-1 text-sm text-text-muted">
            Catálogo de conceptos que se suman a las cuotas (expensas, ABL, wifi, services, etc.).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(143,168,112,0.15),0_8px_24px_-8px_rgba(143,168,112,0.5)] transition-colors hover:bg-olive-vivid sm:self-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo adicional
        </button>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center text-sm text-text-muted">
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
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface/40 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text">{it.name}</h3>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-text-muted">
                    {it.contractsCount} en uso
                  </span>
                </div>
                {it.defaultAmount !== null && (
                  <p className="text-xs text-text-muted">
                    Default: <span className="font-mono text-text">{formatARS(it.defaultAmount)}</span>
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
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted transition-colors hover:bg-surface hover:text-text"
                  >
                    Editar
                  </button>
                  {it.contractsCount === 0 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(it)}
                      className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-500/20"
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
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName(editing?.name ?? "");
          setDefaultAmount(editing?.defaultAmount ?? null);
          setNotes(editing?.notes ?? "");
        }
        onOpenChange(next);
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[min(480px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
              >
                <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <Dialog.Title className="text-base font-semibold text-text">
                    {editing ? "Editar adicional" : "Nuevo adicional"}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-bg hover:text-text"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </Dialog.Close>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Expensas, ABL, Wifi…"
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Importe sugerido <span className="text-text-faint">(opcional)</span>
                      </label>
                      <CurrencyInput
                        value={defaultAmount}
                        onChange={setDefaultAmount}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Notas <span className="text-text-faint">(opcional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <footer className="flex items-center justify-end gap-2 border-t border-border bg-bg/30 px-5 py-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-xl border border-border bg-bg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear"}
                  </button>
                </footer>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
