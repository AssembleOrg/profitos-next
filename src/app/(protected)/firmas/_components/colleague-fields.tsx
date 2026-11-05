"use client";

import { AgencyPicker } from "../../estados-cuenta/_components/agency-picker";
import { CurrencyInput } from "../../alquileres/_components/currency-input";
import { formatMoney } from "@/lib/account";
import { computeSignatureFees } from "@/lib/signatures/fees";
import type { FirmaColleague, FirmaOperation } from "./types";

/** Borrador editable de "operación con colega" (el % como texto del input). */
export interface ColleagueDraft {
  withColleague: boolean;
  agencyId: string | null;
  agencyName: string | null;
  name: string;
  sharePercent: string;
  /** Cobramos el total y le pagamos su parte al colega. */
  collectsAll: boolean;
}

export const EMPTY_COLLEAGUE: ColleagueDraft = {
  withColleague: false,
  agencyId: null,
  agencyName: null,
  name: "",
  sharePercent: "",
  collectsAll: false,
};

export function draftFromColleague(c: FirmaColleague): ColleagueDraft {
  return {
    withColleague: c.withColleague,
    agencyId: c.agencyId,
    agencyName: c.agencyName,
    name: c.name ?? "",
    sharePercent: c.sharePercent != null ? String(c.sharePercent) : "",
    collectsAll: c.collectsAll,
  };
}

/**
 * Valida el borrador y arma el payload para la API.
 * Devuelve un string con el error si falta algo.
 */
export function colleaguePayload(d: ColleagueDraft): Record<string, unknown> | string {
  if (!d.withColleague) return { withColleague: false };
  if (!d.agencyId && !d.name.trim()) return "Indicá la inmobiliaria o el nombre del colega";
  const share = Number(d.sharePercent.replace(",", "."));
  if (d.sharePercent.trim() === "" || !Number.isFinite(share) || share < 0 || share > 100) {
    return "Indicá el % de honorarios que se comparte (0 a 100)";
  }
  return {
    withColleague: true,
    colleagueAgencyId: d.agencyId,
    colleagueName: d.name.trim() || null,
    colleagueSharePercent: share,
    collectsAll: d.collectsAll,
  };
}

const inputClass =
  "h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none disabled:opacity-50";

/** Solapa "¿Trabajamos con colega?" + datos del colega y % compartido. */
export function ColleagueFields({
  value,
  onChange,
  disabled = false,
}: Readonly<{ value: ColleagueDraft; onChange: (next: ColleagueDraft) => void; disabled?: boolean }>) {
  const set = (patch: Partial<ColleagueDraft>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-bg p-1" role="radiogroup" aria-label="¿Trabajamos con colega?">
        {[
          { v: false, label: "100% nuestra" },
          { v: true, label: "Con colega" },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={value.withColleague === opt.v}
            disabled={disabled}
            onClick={() => set({ withColleague: opt.v })}
            className={`flex-1 rounded-full px-4 py-2 text-[13px] transition-colors ${
              value.withColleague === opt.v ? "bg-dark font-bold text-dark-fg" : "font-semibold text-text-muted hover:text-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value.withColleague && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_0.6fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted">Inmobiliaria del colega</span>
            <AgencyPicker
              value={value.agencyId}
              label={value.agencyName}
              onChange={(id, lbl) => set({ agencyId: id, agencyName: lbl })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted">Nombre del colega</span>
            <input
              type="text"
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              disabled={disabled}
              placeholder="Ej. Martín Gómez"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted">% honorarios compartido *</span>
            <div className="flex h-11 items-center rounded-[14px] border border-border bg-surface pr-3.5 focus-within:border-border-strong">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                value={value.sharePercent}
                onChange={(e) => set({ sharePercent: e.target.value })}
                disabled={disabled}
                placeholder="Ej. 50"
                className="min-w-0 flex-1 bg-transparent px-3.5 text-sm tabular-nums text-text placeholder:text-text-faint focus:outline-none"
              />
              <span className="text-sm text-text-faint">%</span>
            </div>
          </label>
        </div>
      )}

      {value.withColleague && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted">¿Quién cobra los honorarios?</span>
          <div className="flex items-center gap-0.5 rounded-full border border-border bg-bg p-1" role="radiogroup" aria-label="¿Quién cobra los honorarios?">
            {[
              { v: false, label: "Cada uno lo suyo" },
              { v: true, label: "Cobramos todo" },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                role="radio"
                aria-checked={value.collectsAll === opt.v}
                disabled={disabled}
                onClick={() => set({ collectsAll: opt.v })}
                className={`flex-1 rounded-full px-4 py-2 text-[13px] transition-colors ${
                  value.collectsAll === opt.v ? "bg-dark font-bold text-dark-fg" : "font-semibold text-text-muted hover:text-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {value.collectsAll && (
            <p className="text-[11.5px] text-text-faint">
              Cobramos el total y la parte del colega queda en Estados de cuenta → A pagar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Operación: valor + moneda + % de honorarios ───────────────────────

export interface OperationDraft {
  amount: number | null;
  currency: "ARS" | "USD";
  feePercentage: string;
  /** Honorarios en % del valor o en monto fijo. */
  feeMode: "percent" | "amount";
  feeAmount: number | null;
}

export const EMPTY_OPERATION: OperationDraft = {
  amount: null,
  currency: "USD",
  feePercentage: "",
  feeMode: "percent",
  feeAmount: null,
};

export function draftFromOperation(o: FirmaOperation): OperationDraft {
  return {
    amount: o.amount,
    currency: o.currency,
    feePercentage: o.feePercentage != null ? String(o.feePercentage) : "",
    feeMode: o.feeAmount != null ? "amount" : "percent",
    feeAmount: o.feeAmount,
  };
}

export function operationPayload(d: OperationDraft): Record<string, unknown> | string {
  const base = { operationAmount: d.amount && d.amount > 0 ? d.amount : null, operationCurrency: d.currency };
  if (d.feeMode === "amount") {
    return { ...base, feePercentage: null, feeAmount: d.feeAmount && d.feeAmount > 0 ? d.feeAmount : null };
  }
  const fee = d.feePercentage.trim() === "" ? null : Number(d.feePercentage.replace(",", "."));
  if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 100)) {
    return "Los honorarios deben ser un % entre 0 y 100";
  }
  return { ...base, feePercentage: fee, feeAmount: null };
}

export function OperationFields({
  value,
  onChange,
  colleague,
  disabled = false,
}: Readonly<{
  value: OperationDraft;
  onChange: (next: OperationDraft) => void;
  colleague: ColleagueDraft;
  disabled?: boolean;
}>) {
  const set = (patch: Partial<OperationDraft>) => onChange({ ...value, ...patch });
  const fees = computeSignatureFees({
    operationAmount: value.amount,
    feePercentage:
      value.feeMode === "amount" || value.feePercentage.trim() === "" ? null : Number(value.feePercentage.replace(",", ".")),
    feeAmount: value.feeMode === "amount" ? value.feeAmount : null,
    withColleague: colleague.withColleague,
    colleagueSharePercent: colleague.sharePercent.trim() === "" ? null : Number(colleague.sharePercent.replace(",", ".")),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted">Valor de la operación</span>
          <CurrencyInput value={value.amount} onChange={(v) => set({ amount: v })} disabled={disabled} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted">Moneda</span>
          <div className="flex h-11 items-center gap-0.5 rounded-full border border-border bg-surface p-1">
            {(["USD", "ARS"] as const).map((c) => (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => set({ currency: c })}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  value.currency === c ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted">Honorarios</span>
          <div className="flex items-center gap-1.5">
            {value.feeMode === "percent" ? (
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-[14px] border border-border bg-surface pr-3.5 focus-within:border-border-strong">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={value.feePercentage}
                  onChange={(e) => set({ feePercentage: e.target.value })}
                  disabled={disabled}
                  placeholder="Ej. 3"
                  aria-label="Honorarios en %"
                  className="min-w-0 flex-1 bg-transparent px-3.5 text-sm tabular-nums text-text placeholder:text-text-faint focus:outline-none"
                />
                <span className="text-sm text-text-faint">%</span>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <CurrencyInput value={value.feeAmount} onChange={(v) => set({ feeAmount: v })} disabled={disabled} />
              </div>
            )}
            <div className="flex h-11 shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface p-1" role="radiogroup" aria-label="Tipo de honorarios">
              {(["percent", "amount"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={value.feeMode === m}
                  disabled={disabled}
                  onClick={() => set({ feeMode: m })}
                  className={`rounded-full px-2.5 py-1.5 text-xs transition-colors ${
                    value.feeMode === m ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
                  }`}
                >
                  {m === "percent" ? "%" : "Fijo"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {fees ? (
        <p className="rounded-[12px] bg-surface px-3.5 py-2 text-[12px] text-text-muted">
          Honorarios {formatMoney(fees.total, value.currency)}
          {fees.colleague > 0 && <> · colega −{formatMoney(fees.colleague, value.currency)}</>}
          {" "}· <span className="font-bold text-olive-light">nuestro {formatMoney(fees.ours, value.currency)}</span>
          {colleague.withColleague && colleague.collectsAll && fees.colleague > 0 ? (
            <> · a cobrar {formatMoney(fees.total, value.currency)} y a pagar al colega {formatMoney(fees.colleague, value.currency)}</>
          ) : (
            <> (aparece en Estados de cuenta → A cobrar)</>
          )}
        </p>
      ) : (
        <p className="text-[11.5px] text-text-faint">
          Con el valor y el % (o un monto fijo) se calculan los honorarios a cobrar en Estados de cuenta. Se pueden cargar después.
        </p>
      )}
    </div>
  );
}
