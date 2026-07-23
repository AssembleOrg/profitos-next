"use client";

import { useRef, useState } from "react";
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
  /** La dueña de Costear puede marcar un egreso como gasto personal → va a Costear. */
  isCostearOwner: boolean;
}

type Destino = "inmobiliaria" | "costear";

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
  isCostearOwner,
}: Readonly<Props>) {
  const router = useRouter();
  const [type, setType] = useState<EntryType>("income");
  const [destino, setDestino] = useState<Destino>("inmobiliaria");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [agentUserId, setAgentUserId] = useState("");
  const [agentPercentage, setAgentPercentage] = useState<string>("");
  const [agentShareType, setAgentShareType] = useState<"percent" | "amount">("percent");
  const [isShared, setIsShared] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertyLabel, setPropertyLabel] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<RentalAttachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Extracción con IA de Costear (foto/audio/texto → borrador de gasto).
  const [merchant, setMerchant] = useState("");
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [iaText, setIaText] = useState("");
  const [iaOpen, setIaOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const categories = type === "income" ? incomeCategories : expenseCategories;
  // Gasto personal de la dueña → va a Costear (no a la caja de la inmobiliaria).
  const isCostear = isCostearOwner && type === "expense" && destino === "costear";

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
    setDestino("inmobiliaria");
    setMerchant("");
    setExtractionId(null);
    setIaText("");
    setIaOpen(false);
    setExtracting(false);
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
      setAgentShareType(editing.agentShareType ?? "percent");
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
      setAgentShareType("percent");
      setIsShared(false);
      setPropertyId(null);
      setPropertyLabel(null);
      setAttachments([]);
      setSignedUrls({});
    }
  }

  function changeType(next: EntryType) {
    setType(next);
    // Los ingresos nunca son gastos personales de Costear.
    if (next === "income") setDestino("inmobiliaria");
    // si la categoría elegida no pertenece al nuevo tipo, la limpiamos
    const pool = next === "income" ? incomeCategories : expenseCategories;
    if (!pool.some((c) => c.id === categoryId)) setCategoryId("");
  }

  interface ProposedDraft {
    title: string;
    merchant?: string;
    amountMinor: number;
    currency: string;
    spentAt: string;
  }

  function applyProposed(proposed: ProposedDraft, id: string) {
    setExtractionId(id);
    if (proposed.title) setDescription(proposed.title);
    if (proposed.merchant) setMerchant(proposed.merchant);
    if (Number.isFinite(proposed.amountMinor)) setAmount(proposed.amountMinor / 100);
    if (proposed.currency === "ARS" || proposed.currency === "USD") setCurrency(proposed.currency);
    const day = proposed.spentAt?.slice(0, 10);
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) setDate(day);
  }

  async function extractFile(file: File) {
    setExtracting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/estados-cuenta/costear/extract", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      applyProposed(body.data.proposed, body.data.extractionId);
      toast.success("Gasto detectado por IA. Revisá los datos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar");
    } finally {
      setExtracting(false);
    }
  }

  async function extractText() {
    if (iaText.trim().length < 3) {
      toast.error("Escribí al menos 3 caracteres");
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/api/estados-cuenta/costear/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: iaText.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      applyProposed(body.data.proposed, body.data.extractionId);
      toast.success("Gasto detectado por IA. Revisá los datos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar");
    } finally {
      setExtracting(false);
    }
  }

  async function submit() {
    // El gasto personal (Costear) no necesita categoría; sí descripción.
    if (isCostear) {
      if (!amount || amount <= 0) {
        toast.error("Ingresá un monto válido");
        return;
      }
      if (!date) {
        toast.error("Elegí una fecha");
        return;
      }
      if (!description.trim()) {
        toast.error("Ingresá una descripción (título del gasto)");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/estados-cuenta/movimientos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personal: true,
            amount,
            currency,
            date,
            description: description.trim(),
            merchant: merchant.trim() || null,
            extractionId,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message ?? "Error");
        toast.success("Gasto personal registrado en Costear");
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar en Costear");
      } finally {
        setSubmitting(false);
      }
      return;
    }

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
        // Valor al agente: solo informativo y solo para egresos (% o monto fijo)
        agentPercentage: type === "expense" ? parsedPercentage : null,
        agentShareType,
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

                    {/* Destino: inmobiliaria vs gasto personal (Costear). Solo la dueña, solo egresos. */}
                    {isCostearOwner && type === "expense" && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Destino del gasto
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDestino("inmobiliaria")}
                            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                              destino === "inmobiliaria"
                                ? "border-olive-bright/40 bg-olive-mid/20 text-accent"
                                : "border-border bg-bg text-text-muted hover:text-text"
                            }`}
                          >
                            Inmobiliaria
                          </button>
                          <button
                            type="button"
                            onClick={() => setDestino("costear")}
                            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                              destino === "costear"
                                ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                                : "border-border bg-bg text-text-muted hover:text-text"
                            }`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                            Mis gastos (Costear)
                          </button>
                        </div>
                        {isCostear && (
                          <p className="mt-1.5 text-xs text-text-faint">
                            Va directo a Costear, no a la caja de la inmobiliaria.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Detectar con IA (Costear): foto de ticket, audio o texto */}
                    {isCostear && (
                      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                            Detectar con IA
                          </span>
                          {extractionId && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-300">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              Detectado
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <IaButton label="Imagen" onClick={() => imageInputRef.current?.click()} disabled={extracting} />
                          <IaButton label="Audio" onClick={() => audioInputRef.current?.click()} disabled={extracting} />
                          <IaButton label="Texto" onClick={() => setIaOpen((v) => !v)} disabled={extracting} />
                        </div>
                        {iaOpen && (
                          <div className="mt-2 flex flex-col gap-2">
                            <textarea
                              rows={2}
                              value={iaText}
                              onChange={(e) => setIaText(e.target.value)}
                              placeholder="ej: gasté 5000 en nafta ayer"
                              className={`${inputClass} resize-none`}
                            />
                            <button
                              type="button"
                              onClick={extractText}
                              disabled={extracting}
                              className="self-end rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/25 disabled:opacity-60"
                            >
                              Extraer texto
                            </button>
                          </div>
                        )}
                        {extracting && (
                          <p className="mt-2 text-xs text-violet-300">Procesando… puede tardar unos segundos.</p>
                        )}
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void extractFile(f);
                            e.target.value = "";
                          }}
                        />
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void extractFile(f);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    )}

                    {/* Compartido (informativo) */}
                    {!isCostear && (
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
                    )}

                    {/* Categoría (no aplica a gastos personales de Costear) */}
                    {!isCostear && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">Categoría</label>
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                        <option value="">Elegí una categoría…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    )}

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

                    {/* Valor al agente (solo egresos, informativo): % o monto fijo */}
                    {type === "expense" && !isCostear && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Valor al agente <span className="text-text-faint">(informativo)</span>
                        </label>
                        <div className="flex items-center gap-1 rounded-xl border border-border bg-bg pr-1 focus-within:border-secondary">
                          {agentShareType === "amount" && (
                            <span className="pl-3 text-sm text-text-faint">{currency === "USD" ? "US$" : "$"}</span>
                          )}
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={agentShareType === "percent" ? 100 : undefined}
                            step="0.01"
                            value={agentPercentage}
                            onChange={(e) => setAgentPercentage(e.target.value)}
                            placeholder="0"
                            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text focus:outline-none"
                          />
                          {/* Mini-selector dentro del input */}
                          <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-surface p-0.5">
                            <button
                              type="button"
                              onClick={() => setAgentShareType("percent")}
                              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                                agentShareType === "percent" ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text"
                              }`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => setAgentShareType("amount")}
                              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                                agentShareType === "amount" ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text"
                              }`}
                            >
                              $ Fijo
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fecha */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">Fecha</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                    </div>

                    {/* Agente + Propiedad (no aplican a gastos personales de Costear) */}
                    {!isCostear && (
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
                    )}

                    {!isCostear && (
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
                    )}

                    {/* Descripción (para Costear es el título del gasto, requerido) */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Descripción {isCostear ? <span className="text-violet-300">(título del gasto)</span> : <span className="text-text-faint">(opcional)</span>}
                      </label>
                      <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
                    </div>

                    {/* Comercio (solo Costear, opcional) */}
                    {isCostear && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                          Comercio <span className="text-text-faint">(opcional)</span>
                        </label>
                        <input type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} className={inputClass} />
                      </div>
                    )}

                    {/* Comprobantes (no aplican a gastos personales de Costear) */}
                    {!isCostear && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Comprobantes <span className="text-text-faint">(opcional)</span>
                      </label>
                      <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={signedUrls} />
                    </div>
                    )}
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

function IaButton({ label, onClick, disabled }: Readonly<{ label: string; onClick: () => void; disabled: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border bg-bg px-2 py-2 text-xs font-semibold text-text-muted transition-colors hover:border-violet-500/40 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}
