"use client";

import { DateField } from "../../_components/date-field";
import { SelectField } from "@/components/ui/select-field";
import { CurrencyInput } from "../../alquileres/_components/currency-input";
import { formatMoney } from "@/lib/account";
import { describeCustody, type CustodyCurrency, type Envelope } from "@/lib/signatures/custody";
import { useHolidayCalendar } from "./holidays-context";
import {
  deLabel,
  formatExpiryLong,
  previewExpiration,
  reminderDatesShort,
  RESERVATION_DAY_TYPE_LABEL,
  RESERVATION_DAY_TYPES,
  type ReservationDayType,
} from "@/lib/signatures/reservation-expiry";

export interface TermDraft {
  date: string;
  termDays: string;
  dayType: ReservationDayType;
}

export const EMPTY_TERM: TermDraft = { date: "", termDays: "", dayType: "business" };

export function termFromFirma(
  date: string | null,
  termDays: number | null,
  dayType: ReservationDayType | null,
): TermDraft {
  return { date: date?.slice(0, 10) ?? "", termDays: termDays?.toString() ?? "", dayType: dayType ?? "business" };
}

/** Valida en el cliente: devuelve el mensaje de error o null. */
export function termError(term: TermDraft, what: string): string | null {
  if (!term.date) return `Ingresá la fecha ${deLabel(what)}`;
  const n = Number(term.termDays);
  if (!Number.isInteger(n) || n <= 0 || n > 3650) return `Ingresá una vigencia válida en días para ${what}`;
  return null;
}

export function sameTerm(a: TermDraft, b: TermDraft): boolean {
  return a.date === b.date && Number(a.termDays) === Number(b.termDays) && a.dayType === b.dayType;
}

export function TermFields({
  idPrefix,
  value,
  onChange,
  dateLabel,
  disabled,
}: Readonly<{
  idPrefix: string;
  value: TermDraft;
  onChange: (next: TermDraft) => void;
  dateLabel: string;
  disabled?: boolean;
}>) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">{dateLabel} *</span>
        <DateField
          id={`${idPrefix}-date`}
          value={value.date}
          onChange={(date) => onChange({ ...value, date })}
          clearable={false}
          disabled={disabled}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">Cantidad de días *</span>
        <input
          id={`${idPrefix}-term`}
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          step={1}
          value={value.termDays}
          onChange={(e) => onChange({ ...value, termDays: e.target.value })}
          placeholder="Ej. 90"
          disabled={disabled}
          className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm tabular-nums text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none disabled:opacity-50"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">Tipo de días *</span>
        <SelectField
          value={value.dayType}
          onChange={(e) => onChange({ ...value, dayType: e.target.value as ReservationDayType })}
          disabled={disabled}
          className="h-11"
        >
          {RESERVATION_DAY_TYPES.map((type) => (
            <option key={type} value={type}>{RESERVATION_DAY_TYPE_LABEL[type]}</option>
          ))}
        </SelectField>
      </label>
    </div>
  );
}

/** "Vence el lunes 11 de enero de 2027 …": se actualiza mientras se escribe. */
export function ExpiryPreview({ term, what }: Readonly<{ term: TermDraft; what: string }>) {
  const holidays = useHolidayCalendar();
  const expiresAt = previewExpiration(term.date, term.termDays, term.dayType, holidays);
  if (!expiresAt) {
    return (
      <p className="rounded-[12px] bg-surface px-3.5 py-2 text-[12px] text-text-faint">
        Completá la fecha y los días para ver hasta cuándo vale {what}.
      </p>
    );
  }
  const [d15, d5] = reminderDatesShort(expiresAt);
  return (
    <p className="rounded-[12px] bg-surface px-3.5 py-2 text-[12px] text-text-muted" aria-live="polite">
      {what.charAt(0).toUpperCase() + what.slice(1)} vence el{" "}
      <span className="font-bold text-warning">{formatExpiryLong(expiresAt)}</span>
      {" · "}
      {term.termDays} {RESERVATION_DAY_TYPE_LABEL[term.dayType].toLowerCase()} · avisos el {d15}, el {d5} y ese día
    </p>
  );
}

export function CalendarCheck({
  checked,
  onChange,
  label,
  disabled,
  hint,
}: Readonly<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  hint?: string;
}>) {
  return (
    <label className={`flex items-start gap-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          checked ? "bg-dark text-accent" : "border border-border-strong bg-surface"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-[13px] font-semibold text-text">{label}</span>
        {hint && <span className="text-[11.5px] text-text-faint">{hint}</span>}
      </span>
    </label>
  );
}

export function ReinforcementToggle({
  value,
  onChange,
  disabled,
}: Readonly<{ value: boolean; onChange: (next: boolean) => void; disabled?: boolean }>) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-1" role="radiogroup" aria-label="¿La reserva tiene refuerzo?">
      {[
        { v: false, label: "Sin refuerzo" },
        { v: true, label: "Con refuerzo" },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          role="radio"
          aria-checked={value === opt.v}
          disabled={disabled}
          onClick={() => onChange(opt.v)}
          className={`flex-1 rounded-full px-4 py-2 text-[13px] transition-colors disabled:opacity-60 ${
            value === opt.v ? "bg-dark font-bold text-dark-fg" : "font-semibold text-text-muted hover:text-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const CALENDAR_HINT = "Se agenda en la cuenta de Google con la que entraste, con avisos 15 y 5 días antes y el día anterior.";

export function calendarFailedMessage(failed: unknown): string | null {
  if (!Array.isArray(failed) || failed.length === 0) return null;
  const what = failed.length === 2 ? "los vencimientos" : failed[0] === "refuerzo" ? "el vencimiento del refuerzo" : "el vencimiento de la reserva";
  return `La propuesta quedó guardada, pero no pudimos agendar ${what} en Google Calendar. Cerrá sesión y volvé a entrar con Google, y probá de nuevo.`;
}

/** Monto que queda en un sobre cerrado (reserva = sobre 1, refuerzo = sobre 2). */
export function EnvelopeField({
  label,
  amount,
  currency,
  onChange,
  disabled,
}: Readonly<{
  label: string;
  amount: number | null;
  currency: CustodyCurrency;
  onChange: (next: { amount: number | null; currency: CustodyCurrency }) => void;
  disabled?: boolean;
}>) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">{label}</span>
        <CurrencyInput value={amount} onChange={(v) => onChange({ amount: v, currency })} disabled={disabled} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-text-muted">Moneda</span>
        <div className="flex h-11 items-center gap-0.5 rounded-full border border-border bg-surface p-1" role="radiogroup" aria-label={`Moneda: ${label}`}>
          {(["USD", "ARS"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={currency === c}
              disabled={disabled}
              onClick={() => onChange({ amount, currency: c })}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                currency === c ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "En resguardo: 2 sobres · US$ 3.000" con el detalle de cada sobre. */
export function CustodySummary({
  envelopes,
  closed,
}: Readonly<{ envelopes: Envelope[]; closed?: boolean }>) {
  if (envelopes.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-[12px] border border-border bg-surface px-3.5 py-2.5">
      <p className="text-[12.5px] text-text">
        <span className="font-bold">{closed ? "Sobres" : "En resguardo"}:</span> {describeCustody(envelopes)}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-text-muted">
        {envelopes.map((e) => (
          <li key={e.number}>
            Sobre {e.number} ({e.kind === "reserva" ? "reserva" : "refuerzo"}): {formatMoney(e.amount, e.currency)}
          </li>
        ))}
      </ul>
    </div>
  );
}
