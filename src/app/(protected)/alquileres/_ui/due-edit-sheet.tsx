"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { CurrencyInput } from "../_components/currency-input";
import type { DossierDue } from "@/lib/rentals/dto";
import { Check, Field, Segmented, api, btnPrimary, btnText, dateAR, money, textareaBox } from "./kit";

type ManualStatus = "auto" | "condonado";

/**
 * Ajustes de una cuota puntual: qué conceptos del contrato se cobran ese mes
 * (y con qué monto), notas, o condonarla.
 */
export function DueEditSheet({
  due,
  currency,
  onClose,
  onDone,
}: {
  due: DossierDue | null;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [lines, setLines] = useState<DossierDue["lines"]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ManualStatus>("auto");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!due) return;
    setLines(due.lines);
    setNotes(due.notes ?? "");
    setStatus(due.manualStatus === "condonado" ? "condonado" : "auto");
  }, [due]);

  const total = (due?.rent ?? 0) + lines.filter((l) => l.included).reduce((a, l) => a + l.amount, 0);

  async function submit() {
    if (!due) return;
    setSaving(true);
    try {
      const statusPatch =
        status === "condonado" && due.manualStatus !== "condonado"
          ? { status: "condonado" }
          : status === "auto" && due.manualStatus === "condonado"
            ? { status: null }
            : {};
      await api(`/api/alquileres/vencimientos/${due.id}`, {
        method: "PATCH",
        json: {
          notes,
          additionals: lines.map((l) => ({ contractAdditionalId: l.contractAdditionalId, included: l.included, amountOverride: l.amount })),
          ...statusPatch,
        },
      });
      toast.success("Cuota actualizada");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={Boolean(due)}
      onClose={onClose}
      title={due ? `Cuota ${due.position} · vence ${dateAR(due.dueDate)}` : "Cuota"}
      description="Lo que se espera cobrar ese mes."
      maxWidth="sm:max-w-lg"
      footer={
        <>
          <button type="button" className={btnText} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={saving} onClick={submit}>
            {saving ? "Guardando…" : "Guardar cuota"}
          </button>
        </>
      }
    >
      {due && (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border rounded-[18px] border border-border">
            <li className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="text-[13.5px] text-text">Alquiler</span>
              <span className="font-display text-[14px] font-bold tabular-nums text-text">{money(due.rent, currency)}</span>
            </li>
            {lines.map((l) => (
              <li key={l.linkId} className="flex items-center gap-3 px-3.5 py-2.5">
                <Check checked={l.included} onChange={(v) => setLines((prev) => prev.map((x) => (x.linkId === l.linkId ? { ...x, included: v } : x)))} />
                <span className={`min-w-0 flex-1 truncate text-[13.5px] ${l.included ? "text-text" : "text-text-faint line-through"}`}>{l.name}</span>
                <div className="w-[132px] shrink-0">
                  <CurrencyInput
                    value={l.amount}
                    disabled={!l.included}
                    onChange={(v) => setLines((prev) => prev.map((x) => (x.linkId === l.linkId ? { ...x, amount: v ?? 0 } : x)))}
                  />
                </div>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-bg px-3.5 py-3">
              <span className="text-[13px] font-semibold text-text-muted">Total esperado</span>
              <span className="font-display text-[16px] font-bold tabular-nums text-text">{money(total, currency)}</span>
            </li>
          </ul>
          <p className="text-[12px] text-text-faint">Para cambiar el alquiler de este mes en adelante usá “Aplicar aumento”.</p>
          <Field label="Estado">
            <Segmented
              ariaLabel="Estado de la cuota"
              value={status}
              onChange={setStatus}
              options={[
                { value: "auto", label: "Según cobros" },
                { value: "condonado", label: "Condonada" },
              ]}
            />
          </Field>
          <Field label="Notas de la cuota">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaBox} />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
