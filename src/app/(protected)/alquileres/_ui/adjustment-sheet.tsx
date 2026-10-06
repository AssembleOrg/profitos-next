"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { DateField } from "../../_components/date-field";
import { CurrencyInput } from "../_components/currency-input";
import { IconTrend } from "./icons";
import { Field, api, btnPrimary, btnText, dateAR, money, propertyLine, textareaBox } from "./kit";

export interface AdjustmentTarget {
  contractId: string;
  date: string | null;
  index: string | null;
  everyMonths: number | null;
  currentAmount: number;
  currency: string;
  address: string;
  unit: string | null;
  tenantName: string;
}

/**
 * Aplicar un aumento. Sin validaciones de índice: la admin pone el monto nuevo
 * y desde qué vencimiento rige; las cuotas ya cobradas no se tocan.
 */
export function AdjustmentSheet({
  target,
  onClose,
  onDone,
}: {
  target: AdjustmentTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [index, setIndex] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setAmount(null);
    setFrom(target.date ?? "");
    setIndex(target.index ?? "");
    setNotes("");
  }, [target]);

  const pct = target && amount ? ((amount - target.currentAmount) / target.currentAmount) * 100 : null;

  async function submit() {
    if (!target || !amount || !from) return;
    setSaving(true);
    try {
      await api(`/api/alquileres/${target.contractId}/aumentos`, {
        method: "POST",
        json: { newAmount: amount, effectiveDate: from, indexLabel: index, notes },
      });
      toast.success(`Aumento aplicado: ${money(amount, target.currency)} desde ${dateAR(from)}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aplicar el aumento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={Boolean(target)}
      onClose={onClose}
      title="Aplicar aumento"
      description={target ? `${propertyLine(target.address, target.unit)} · ${target.tenantName}` : undefined}
      maxWidth="sm:max-w-lg"
      footer={
        <>
          <button type="button" className={btnText} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={saving || !amount || !from}>
            <IconTrend size={16} className="text-accent" />
            {saving ? "Aplicando…" : "Aplicar aumento"}
          </button>
        </>
      }
    >
      {target && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3 rounded-[18px] bg-bg px-4 py-3">
            <div>
              <p className="text-[12.5px] text-text-muted">Alquiler actual</p>
              <p className="font-display text-[22px] font-bold tabular-nums text-text">{money(target.currentAmount, target.currency)}</p>
            </div>
            <p className="text-right text-[12.5px] text-text-muted">
              {target.everyMonths ? `Aumenta cada ${target.everyMonths} meses` : "Sin frecuencia fija"}
              {target.index && (
                <>
                  <br />
                  por {target.index}
                </>
              )}
            </p>
          </div>

          <Field
            label="Alquiler nuevo"
            hint={
              pct !== null && Number.isFinite(pct) ? (
                <span className={pct >= 0 ? "text-olive-light" : "text-terra"}>
                  {pct >= 0 ? "+" : ""}
                  {pct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% respecto del actual
                </span>
              ) : (
                "El monto que surge del índice o del acuerdo entre partes."
              )
            }
          >
            <CurrencyInput value={amount} onChange={setAmount} placeholder="0" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rige desde" hint="Primer vencimiento con el monto nuevo.">
              <DateField value={from} onChange={setFrom} />
            </Field>
            <Field label="Índice o concepto">
              <input value={index} onChange={(e) => setIndex(e.target.value)} placeholder="IPC, ICL, acuerdo…" className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text outline-none placeholder:text-text-faint focus:border-accent" />
            </Field>
          </div>
          <Field label="Nota (opcional)">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaBox} />
          </Field>
          <p className="text-[12px] leading-relaxed text-text-faint">
            Las cuotas ya cobradas no cambian. Si cobraste un mes con el monto viejo, sumá la diferencia en el próximo cobro como
            “Diferencia de aumento”.
          </p>
        </div>
      )}
    </Sheet>
  );
}
