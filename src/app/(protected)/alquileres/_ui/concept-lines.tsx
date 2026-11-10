"use client";

import type { ChargeLine } from "@/lib/rentals/money";
import { CurrencyInput } from "../_components/currency-input";
import { IconPlus, IconX } from "./icons";
import { Check, Segmented, btnSecondarySm } from "./kit";

/** Concepto editable de un cobro. Lo comparten la hoja de cobro y la de corrección. */
export interface EditableLine extends ChargeLine {
  key: string;
  included: boolean;
  /** El concepto descuenta del total. `amount` se edita siempre en positivo. */
  subtract?: boolean;
}

const QUICK_EXTRAS = ["Punitorios", "Diferencia de aumento", "Expensas", "Otros"];

let lineSeq = 0;
export const nextLineKey = () => `l${++lineSeq}`;

/** Conceptos que entran al cobro, con el signo ya aplicado. */
export function activeLines(lines: EditableLine[]): EditableLine[] {
  return lines.filter((l) => l.included && l.amount > 0).map((l) => (l.subtract ? { ...l, amount: -l.amount } : l));
}

/** Lo que viaja al server: sin los campos de edición. */
export function toChargeLines(lines: EditableLine[]): ChargeLine[] {
  return activeLines(lines).map(({ kind, label, amount, refId, affectsFee }) => ({ kind, label, amount, refId, affectsFee }));
}

/** Conceptos guardados de un cobro → editables (los que restan vuelven a positivo + "Resta"). */
export function fromChargeLines(lines: ChargeLine[]): EditableLine[] {
  return lines.map((l) => ({ ...l, key: nextLineKey(), included: true, amount: Math.abs(l.amount), subtract: l.amount < 0 }));
}

export function ConceptLines({
  lines,
  onChange,
  title = "Conceptos del mes",
}: {
  lines: EditableLine[];
  onChange: (update: (prev: EditableLine[]) => EditableLine[]) => void;
  title?: string;
}) {
  const patchLine = (key: string, patch: Partial<EditableLine>) => onChange((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addExtra = (label: string) => onChange((prev) => [...prev, { key: nextLineKey(), kind: "extra", label, amount: 0, included: true }]);

  return (
    <section aria-labelledby="concepts-title">
      <h3 id="concepts-title" className="mb-2 font-display text-[15px] font-semibold text-text">
        {title}
      </h3>
      <ul className="flex flex-col divide-y divide-border rounded-[18px] border border-border">
        {lines.map((l) => (
          <li key={l.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
            <Check checked={l.included} onChange={(v) => patchLine(l.key, { included: v })} />
            {l.kind === "extra" ? (
              <input
                aria-label="Concepto"
                value={l.label}
                onChange={(e) => patchLine(l.key, { label: e.target.value })}
                className="h-9 min-w-0 flex-1 rounded-[10px] border border-transparent bg-bg px-2.5 text-[13.5px] text-text outline-none focus:border-accent"
              />
            ) : (
              <span className={`min-w-0 flex-1 truncate text-[13.5px] ${l.included ? "text-text" : "text-text-faint line-through"}`}>
                {l.label}
                {l.kind === "rent" && <span className="ml-1.5 text-[11.5px] text-text-faint">base de honorarios</span>}
              </span>
            )}
            {l.kind !== "rent" && (
              <Segmented
                size="sm"
                ariaLabel={`Suma o resta: ${l.label}`}
                value={l.subtract ? "resta" : "suma"}
                onChange={(v) => patchLine(l.key, { subtract: v === "resta" })}
                options={[
                  { value: "suma", label: "Suma" },
                  { value: "resta", label: "Resta" },
                ]}
              />
            )}
            <div className="w-[132px] shrink-0">
              <CurrencyInput value={l.amount} onChange={(v) => patchLine(l.key, { amount: v ?? 0 })} disabled={!l.included} />
            </div>
            {l.kind === "extra" && (
              <button
                type="button"
                aria-label={`Quitar ${l.label}`}
                onClick={() => onChange((prev) => prev.filter((x) => x.key !== l.key))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-faint hover:bg-clay-chip hover:text-terra"
              >
                <IconX size={14} />
              </button>
            )}
            {l.kind !== "rent" && (
              <div className="flex w-full items-center gap-2 pl-8 text-[12px] text-text-muted">
                <Check checked={!!l.affectsFee} onChange={(v) => patchLine(l.key, { affectsFee: v })} label="Afecta honorarios" />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_EXTRAS.map((label) => (
          <button key={label} type="button" onClick={() => addExtra(label)} className={btnSecondarySm}>
            <IconPlus size={13} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
