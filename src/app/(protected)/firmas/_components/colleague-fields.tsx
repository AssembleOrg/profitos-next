"use client";

import { AgencyPicker } from "../../estados-cuenta/_components/agency-picker";
import type { FirmaColleague } from "./types";

/** Borrador editable de "operación con colega" (el % como texto del input). */
export interface ColleagueDraft {
  withColleague: boolean;
  agencyId: string | null;
  agencyName: string | null;
  name: string;
  sharePercent: string;
}

export const EMPTY_COLLEAGUE: ColleagueDraft = {
  withColleague: false,
  agencyId: null,
  agencyName: null,
  name: "",
  sharePercent: "",
};

export function draftFromColleague(c: FirmaColleague): ColleagueDraft {
  return {
    withColleague: c.withColleague,
    agencyId: c.agencyId,
    agencyName: c.agencyName,
    name: c.name ?? "",
    sharePercent: c.sharePercent != null ? String(c.sharePercent) : "",
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
    </div>
  );
}
