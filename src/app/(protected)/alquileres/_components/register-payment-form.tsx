"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatARS } from "@/lib/rentals";
import { now } from "@/lib/datetime";
import { CurrencyInput } from "./currency-input";
import { SelectField } from "@/components/ui/select-field";
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
        className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Registrar pago
      </button>
    );
  }

  return (
    <div className="rounded-[16px] border border-border bg-bg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-display text-[15px] font-semibold text-text">Registrar pago</h4>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-faint hover:bg-surface hover:text-text"
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
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setIsFull(true)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              isFull ? "bg-success-chip font-bold text-success" : "font-medium text-text-faint hover:text-text"
            }`}
          >
            Pago total
          </button>
          <button
            type="button"
            onClick={() => setIsFull(false)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              !isFull ? "bg-warning-chip font-bold text-warning" : "font-medium text-text-faint hover:text-text"
            }`}
          >
            Pago parcial
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Total cobrado al inquilino
            </label>
            <CurrencyInput value={amountPaid} onChange={setAmountPaid} />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Comisión inmobiliaria
            </label>
            <CurrencyInput value={commissionAmount} onChange={setCommissionAmount} />
          </div>
        </div>

        <div className="rounded-[12px] bg-sage-chip px-3 py-2 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Esperado de la cuota:</span>
            <span className="font-display font-bold text-text">{formatARS(due.expectedAmount)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-text-muted">Para el dueño (auto):</span>
            <span className="font-display font-bold text-text">{formatARS(Math.max(0, ownerAmount))}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Método
            </label>
            <SelectField
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="mercadopago">MercadoPago</option>
              <option value="otro">Otro</option>
            </SelectField>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Fecha de pago
            </label>
            <DateField value={paidAt} onChange={setPaidAt} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
            Notas <span className="text-text-faint">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text focus:border-border-strong focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
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
          className="h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Registrando…" : "Confirmar pago y emitir comprobante"}
        </button>
      </div>
    </div>
  );
}
