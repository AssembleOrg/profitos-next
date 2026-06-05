"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatARS } from "@/lib/rentals";
import { now } from "@/lib/datetime";
import { CurrencyInput } from "./currency-input";
import { MediaUploader } from "./media-uploader";
import { useSignedUrls } from "./use-signed-urls";
import { DateField } from "../../_components/date-field";
import type { RentalAttachment } from "./voice-recorder";
import type { PaymentTransaction, SerializedDueDate } from "./types";

interface RegisterPaymentFormProps {
  due: SerializedDueDate;
  onRegistered: (payment: PaymentTransaction) => void;
}

export function RegisterPaymentForm({ due, onRegistered }: Readonly<RegisterPaymentFormProps>) {
  const [open, setOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState<number | null>(null);
  const [commissionAmount, setCommissionAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<string>("transferencia");
  const [paidAt, setPaidAt] = useState<string>(() => now().toISODate()!);
  const [isFull, setIsFull] = useState(true);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<RentalAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const paths = attachments.map((a) => a.path);
  const signedUrls = useSignedUrls(paths);

  // Default amount = expected del due
  useEffect(() => {
    if (open) {
      setAmountPaid(due.expectedAmount);
      setCommissionAmount(0);
      setIsFull(true);
      setNotes("");
      setAttachments([]);
      setMethod("transferencia");
      setPaidAt(now().toISODate()!);
    }
  }, [open, due.expectedAmount]);

  const ownerAmount = (amountPaid ?? 0) - (commissionAmount ?? 0);

  async function submit() {
    if (amountPaid === null || amountPaid <= 0) {
      toast.error("Ingresá el monto cobrado");
      return;
    }
    if ((commissionAmount ?? 0) > amountPaid) {
      toast.error("La comisión no puede ser mayor que el total");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/alquileres/vencimientos/${due.id}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaid,
          commissionAmount: commissionAmount ?? 0,
          method: method.trim() || null,
          paidAt: new Date(paidAt).toISOString(),
          isFull,
          notes: notes.trim() || null,
          attachments,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onRegistered(body.data as PaymentTransaction);
      toast.success("Pago registrado · comprobante generado");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(143,168,112,0.15),0_8px_24px_-8px_rgba(143,168,112,0.5)] transition-colors hover:bg-olive-vivid"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Registrar pago
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-olive-bright/30 bg-olive-subtle/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text">Registrar pago</h4>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:text-text"
          aria-label="Cerrar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Total/parcial toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg/40 p-1">
          <button
            type="button"
            onClick={() => setIsFull(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              isFull ? "bg-emerald-500/20 text-emerald-300" : "text-text-muted hover:text-text"
            }`}
          >
            Pago total
          </button>
          <button
            type="button"
            onClick={() => setIsFull(false)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              !isFull ? "bg-amber-500/20 text-amber-300" : "text-text-muted hover:text-text"
            }`}
          >
            Pago parcial
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Total cobrado al inquilino
            </label>
            <CurrencyInput value={amountPaid} onChange={setAmountPaid} />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Comisión inmobiliaria
            </label>
            <CurrencyInput value={commissionAmount} onChange={setCommissionAmount} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg/40 px-3 py-2 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Esperado de la cuota:</span>
            <span className="font-mono text-text">{formatARS(due.expectedAmount)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-text-muted">Para el dueño (auto):</span>
            <span className="font-mono text-text">{formatARS(Math.max(0, ownerAmount))}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Método
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="mercadopago">MercadoPago</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Fecha de pago
            </label>
            <DateField value={paidAt} onChange={setPaidAt} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Notas <span className="text-text-faint">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Adjuntos <span className="text-text-faint">(comprobante de transferencia, captura, etc.)</span>
          </label>
          <MediaUploader
            attachments={attachments}
            onChange={setAttachments}
            signedUrls={signedUrls}
            compact
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(143,168,112,0.15),0_8px_24px_-8px_rgba(143,168,112,0.5)] transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Registrando…" : "Confirmar pago y emitir comprobante"}
        </button>
      </div>
    </div>
  );
}
