"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import type { PaymentDTO } from "@/lib/rentals/dto";
import { CORRECTION_FREE_HOURS } from "@/lib/rentals/correction";
import { formatReceiptNo, splitCharges } from "@/lib/rentals/money";
import { ConceptLines, activeLines, fromChargeLines, toChargeLines, type EditableLine } from "./concept-lines";
import { IconCheck, IconFlag, IconPencil } from "./icons";
import { Field, api, btnPrimary, btnText, dateAR, money, textareaBox } from "./kit";

export interface CorrectTarget {
  dueId: string;
  payment: PaymentDTO;
  currency: string;
  /** "Noviembre 2026 · Mitre 913" */
  description: string;
  /** Pasaron las 96 horas desde que se registró el cobro (se calcula al abrir). */
  late: boolean;
}

interface CorrectResult {
  receiptIds: string[];
  pdfErrors: string[];
}

/**
 * Corregir un cobro ya emitido: mismos conceptos que la hoja de cobro, pero
 * sobre recibos que ya existen. Conservan el número y se vuelven a dibujar.
 * Las primeras 96 horas es libre; después pide el motivo. Siempre queda registrado.
 */
export function CorrectSheet({ target, onClose, onDone }: { target: CorrectTarget | null; onClose: () => void; onDone: () => void }) {
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [feePercent, setFeePercent] = useState(0);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CorrectResult | null>(null);

  useEffect(() => {
    if (!target) return;
    setLines(fromChargeLines(target.payment.lines ?? []));
    setFeePercent(target.payment.feePercent ?? 0);
    setReceiptNotes(target.payment.receiptNotes ?? "");
    setReason("");
    setResult(null);
  }, [target]);

  const split = useMemo(() => splitCharges(activeLines(lines), feePercent), [lines, feePercent]);
  const p = target?.payment ?? null;
  const currency = target?.currency ?? "ARS";
  const sig = (ls: Array<{ kind: string; label: string; amount: number; affectsFee?: boolean }>) =>
    JSON.stringify(ls.map((l) => [l.kind, l.label.trim(), Math.round(l.amount * 100), Boolean(l.affectsFee)]));
  const changed =
    p !== null &&
    (sig(toChargeLines(lines)) !== sig(p.lines ?? []) ||
      Math.round(split.feePercent * 100) !== Math.round((p.feePercent ?? 0) * 100) ||
      receiptNotes.trim() !== (p.receiptNotes ?? "").trim());
  const missingReason = Boolean(target?.late) && !reason.trim();
  const emitted = p?.receipts.filter((r) => r.status === "emitido") ?? [];

  async function submit() {
    if (!target || saving) return;
    if (split.tenantTotal <= 0) {
      toast.error("El total tiene que ser mayor a cero");
      return;
    }
    setSaving(true);
    try {
      const data = await api<CorrectResult>(`/api/alquileres/vencimientos/${target.dueId}/pagos/${target.payment.id}`, {
        method: "PATCH",
        json: { lines: toChargeLines(lines), feePercent, receiptNotes, reason },
      });
      setResult(data);
      if (data.pdfErrors.length) toast.warning("La corrección quedó guardada, pero algún PDF no se regeneró. Abrilo de nuevo para reintentar.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo corregir el cobro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={Boolean(target)}
      onClose={onClose}
      title={result ? "Cobro corregido" : "Corregir cobro"}
      description={target?.description}
      maxWidth="sm:max-w-[640px]"
      closeOnOverlay={false}
      footer={
        result ? (
          <>
            <span />
            <button type="button" className={btnPrimary} onClick={onClose}>
              Listo
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btnText} onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className={btnPrimary} onClick={submit} disabled={!target || saving || !changed || missingReason || split.tenantTotal <= 0}>
              <IconPencil size={15} className="text-accent" />
              {saving ? "Guardando…" : "Guardar corrección"}
            </button>
          </>
        )
      }
    >
      {target && p && result && (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-chip text-olive-light">
            <IconCheck size={26} />
          </div>
          <p className="mt-3 font-display text-[20px] font-semibold text-text">{money(split.tenantTotal, currency)}</p>
          <p className="mt-1 max-w-sm text-[13px] text-text-muted">
            Los recibos conservan su número y ya salen con los montos nuevos. Si los habías impreso, volvé a imprimirlos.
          </p>
          <ul className="mt-5 flex w-full max-w-md flex-col gap-2">
            {emitted.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-border px-3.5 py-2.5 text-[13px] text-text">
                <span>
                  {r.bookKind === "inquilino" ? "Inquilino" : "Propietario"} {formatReceiptNo(r.pointOfSale, r.number)}
                </span>
                <ReceiptPrintLinks receiptId={r.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {target && p && !result && (
        <div className="flex flex-col gap-5">
          <p className={`flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-[12.5px] text-text ${target.late ? "bg-clay-chip" : "bg-sand-chip"}`}>
            <IconFlag size={15} className={`mt-0.5 shrink-0 ${target.late ? "text-terra" : "text-accent"}`} />
            <span>
              Cobro registrado el {dateAR(p.createdAt)} por {p.createdBy}.{" "}
              {target.late
                ? `Ya pasaron las ${CORRECTION_FREE_HOURS} horas: se puede corregir igual, pero hay que dejar el motivo.`
                : `Está dentro de las primeras ${CORRECTION_FREE_HOURS} horas.`}{" "}
              Los recibos conservan su número y la corrección queda registrada con tu nombre y la hora.
            </span>
          </p>

          {p.ownerPaidAt && (
            <p role="alert" className="rounded-[14px] bg-clay-chip px-3.5 py-2.5 text-[12.5px] text-terra">
              El propietario ya retiró su parte de este cobro ({money(p.ownerAmount, currency)}) el {dateAR(p.ownerPaidAt)}. Si cambia el neto, la
              diferencia hay que arreglarla aparte con él.
            </p>
          )}

          <ConceptLines lines={lines} onChange={setLines} title="Conceptos del recibo" />

          <label className="flex items-center gap-2 text-[12.5px] text-text-muted">
            Honorarios
            <span className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.5}
                value={Number.isFinite(feePercent) ? feePercent : ""}
                onChange={(e) => setFeePercent(e.target.value === "" ? 0 : Number(e.target.value))}
                aria-label="Porcentaje de honorarios"
                className="h-8 w-[68px] rounded-full border border-border bg-surface pl-3 pr-6 text-[13px] font-bold tabular-nums text-text outline-none focus:border-accent"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-text-faint">%</span>
            </span>
          </label>

          <dl className="grid gap-px overflow-hidden rounded-[18px] border border-border bg-border text-[13px]">
            <BeforeAfter label="Recibo al inquilino" before={p.amountPaid} after={split.tenantTotal} currency={currency} strong />
            <BeforeAfter label="Honorarios" before={p.commissionAmount} after={split.feeAmount} currency={currency} />
            <BeforeAfter label="Recibo al propietario" before={p.ownerAmount} after={split.ownerTotal} currency={currency} />
          </dl>

          <Field label="Observaciones del recibo" hint="Se imprimen en los dos recibos.">
            <textarea rows={2} value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} className={textareaBox} />
          </Field>

          <Field
            label={target.late ? "Motivo de la corrección" : "Motivo de la corrección (opcional)"}
            hint={target.late ? `Obligatorio porque pasaron más de ${CORRECTION_FREE_HOURS} horas. Solo lo ve el equipo.` : "Solo lo ve el equipo."}
          >
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: se acordó un valor menor por este mes"
              className={textareaBox}
            />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function BeforeAfter({ label, before, after, currency, strong }: { label: string; before: number; after: number; currency: string; strong?: boolean }) {
  const same = Math.round(before * 100) === Math.round(after * 100);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 bg-surface px-3.5 py-2.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-display font-bold" : "font-semibold"} text-text`}>
        {!same && <span className="mr-2 font-normal text-text-faint line-through">{money(before, currency)}</span>}
        {money(after, currency)}
      </dd>
    </div>
  );
}

/** Los dos formatos de impresión de un recibo: dos hojas A5 (2 por hoja) o A4 apaisada. */
export function ReceiptPrintLinks({ receiptId }: { receiptId: string }) {
  const base = "rounded-full px-2.5 py-0.5 text-[11px] font-bold no-underline";
  return (
    <span className="inline-flex items-center gap-1">
      <a href={`/api/alquileres/recibos/${receiptId}/pdf`} target="_blank" rel="noreferrer" title="Dos hojas: imprimir a 2 por hoja" className={`${base} bg-dark text-dark-fg`}>
        PDF
      </a>
      <a
        href={`/api/alquileres/recibos/${receiptId}/pdf?formato=a4`}
        target="_blank"
        rel="noreferrer"
        title="A4 apaisada: las dos copias ya armadas en una hoja"
        className={`${base} border border-border bg-surface text-text-muted hover:text-text`}
      >
        A4
      </a>
    </span>
  );
}
