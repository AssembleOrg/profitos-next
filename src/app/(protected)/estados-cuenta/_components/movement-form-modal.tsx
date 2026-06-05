"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { now } from "@/lib/datetime";
import { CurrencyInput } from "../../alquileres/_components/currency-input";
import { MediaUploader } from "../../alquileres/_components/media-uploader";
import type { RentalAttachment } from "../../alquileres/_components/voice-recorder";
import type { AccountMovement, Currency, EntryType } from "@/lib/account";
import type { SerializedAgent, SerializedCategory } from "./estados-cuenta-client";
import { PropertyPicker } from "./property-picker";

function asAttachments(value: unknown): RentalAttachment[] {
  return Array.isArray(value) ? (value as RentalAttachment[]) : [];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AccountMovement | null;
  incomeCategories: SerializedCategory[];
  expenseCategories: SerializedCategory[];
  agents: SerializedAgent[];
  defaultDate: string;
}

const inputClass =
  "w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none";

export function MovementFormModal({
  open,
  onOpenChange,
  editing,
  incomeCategories,
  expenseCategories,
  agents,
  defaultDate,
}: Readonly<Props>) {
  const router = useRouter();
  const [type, setType] = useState<EntryType>("income");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [agentUserId, setAgentUserId] = useState("");
  const [agentPercentage, setAgentPercentage] = useState<string>("");
  const [isShared, setIsShared] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertyLabel, setPropertyLabel] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<RentalAttachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const categories = type === "income" ? incomeCategories : expenseCategories;

  async function loadSignedUrls(atts: RentalAttachment[]) {
    const paths = atts.map((a) => a.path).filter(Boolean);
    if (paths.length === 0) {
      setSignedUrls({});
      return;
    }
    try {
      const res = await fetch("/api/alquileres/signed-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const body = await res.json();
      setSignedUrls(body?.urls ?? {});
    } catch {
      setSignedUrls({});
    }
  }

  function init() {
    if (editing) {
      const atts = asAttachments(editing.attachments);
      setType(editing.type);
      setCategoryId(editing.categoryId ?? "");
      setAmount(editing.amount);
      setCurrency(editing.currency);
      setDate(editing.date);
      setDescription(editing.description ?? "");
      setAgentUserId(editing.agentUserId ?? "");
      setAgentPercentage(editing.agentPercentage != null ? String(editing.agentPercentage) : "");
      setIsShared(editing.isShared ?? false);
      setPropertyId(editing.propertyId ?? null);
      setPropertyLabel(editing.propertyAddress ?? null);
      setAttachments(atts);
      void loadSignedUrls(atts);
    } else {
      setType("income");
      setCategoryId("");
      setAmount(null);
      setCurrency("ARS");
      setDate(defaultDate || now().toISODate()!);
      setDescription("");
      setAgentUserId("");
      setAgentPercentage("");
      setIsShared(false);
      setPropertyId(null);
      setPropertyLabel(null);
      setAttachments([]);
      setSignedUrls({});
    }
  }

  function changeType(next: EntryType) {
    setType(next);
    // si la categoría elegida no pertenece al nuevo tipo, la limpiamos
    const pool = next === "income" ? incomeCategories : expenseCategories;
    if (!pool.some((c) => c.id === categoryId)) setCategoryId("");
  }

  async function submit() {
    if (!categoryId) {
      toast.error("Elegí una categoría");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    if (!date) {
      toast.error("Elegí una fecha");
      return;
    }
    setSubmitting(true);
    try {
      const parsedPercentage = agentPercentage.trim() === "" ? null : Number(agentPercentage.replace(",", "."));
      const payload = {
        categoryId,
        amount,
        currency,
        date,
        description: description.trim() || null,
        agentUserId: agentUserId || null,
        propertyId: propertyId || null,
        // % al agente: solo informativo y solo para egresos
        agentPercentage: type === "expense" ? parsedPercentage : null,
        isShared,
        attachments,
      };
      const res = await fetch(
        editing ? `/api/estados-cuenta/movimientos/${editing.id}` : "/api/estados-cuenta/movimientos",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success(editing ? "Movimiento actualizado" : "Movimiento registrado");
      onOpenChange(false);
      router.refresh();
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
        if (next) init();
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
                <header className="flex items-center justify-between gap-3 border-b border-border-olive/40 px-5 py-4">
                  <Dialog.Title className="text-base font-semibold text-text">
                    {editing ? "Editar movimiento" : "Nuevo movimiento"}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-bg hover:text-text">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </Dialog.Close>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="flex flex-col gap-4">
                    {/* Tipo */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => changeType("income")}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                          type === "income"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-border bg-bg text-text-muted hover:text-text"
                        }`}
                      >
                        Ingreso
                      </button>
                      <button
                        type="button"
                        onClick={() => changeType("expense")}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                          type === "expense"
                            ? "border-red-500/40 bg-red-500/15 text-red-300"
                            : "border-border bg-bg text-text-muted hover:text-text"
                        }`}
                      >
                        Egreso
                      </button>
                    </div>

                    {/* Compartido (informativo) */}
                    <button
                      type="button"
                      onClick={() => setIsShared((v) => !v)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                        isShared
                          ? "border-accent/40 bg-accent/15 text-accent"
                          : "border-border bg-bg text-text-muted hover:text-text"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                        Movimiento compartido
                      </span>
                      <span
                        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${isShared ? "bg-accent/40" : "bg-border"}`}
                      >
                        <span className={`h-4 w-4 rounded-full bg-text transition-transform ${isShared ? "translate-x-4" : ""}`} />
                      </span>
                    </button>

                    {/* Categoría */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">Categoría</label>
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                        <option value="">Elegí una categoría…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Monto + Moneda */}
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">Monto</label>
                        <CurrencyInput value={amount} onChange={setAmount} placeholder="0" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">Moneda</label>
                        <div className="flex h-[38px] items-center gap-1 rounded-xl border border-border bg-bg p-1">
                          {(["ARS", "USD"] as Currency[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCurrency(c)}
                              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                                currency === c ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text"
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* % al agente (solo egresos, informativo) */}
                    {type === "expense" && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                          % al agente <span className="text-text-faint">(informativo)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="0.01"
                            value={agentPercentage}
                            onChange={(e) => setAgentPercentage(e.target.value)}
                            placeholder="0"
                            className={`${inputClass} pr-8`}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">%</span>
                        </div>
                      </div>
                    )}

                    {/* Fecha */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">Fecha</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                    </div>

                    {/* Agente */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Agente <span className="text-text-faint">(opcional)</span>
                      </label>
                      <select value={agentUserId} onChange={(e) => setAgentUserId(e.target.value)} className={inputClass}>
                        <option value="">Sin asignar</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Propiedad */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Propiedad <span className="text-text-faint">(opcional)</span>
                      </label>
                      <PropertyPicker
                        value={propertyId}
                        label={propertyLabel}
                        onChange={(id, lbl) => {
                          setPropertyId(id);
                          setPropertyLabel(lbl);
                        }}
                      />
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Descripción <span className="text-text-faint">(opcional)</span>
                      </label>
                      <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
                    </div>

                    {/* Comprobantes */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Comprobantes <span className="text-text-faint">(opcional)</span>
                      </label>
                      <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={signedUrls} />
                    </div>
                  </div>
                </div>

                <footer className="flex items-center justify-end gap-2 border-t border-border bg-bg/30 px-5 py-3">
                  <Dialog.Close asChild>
                    <button type="button" className="rounded-xl border border-border bg-bg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Registrar"}
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
