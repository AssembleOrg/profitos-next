import { formatMoney } from "@/lib/account";
import type { ExpiryKind } from "./reservation-expiry";

export type CustodyCurrency = "USD" | "ARS";

/** Un sobre cerrado en resguardo: la reserva es el sobre 1 y el refuerzo el 2. */
export interface Envelope {
  number: 1 | 2;
  kind: ExpiryKind;
  amount: number;
  currency: CustodyCurrency;
}

export function toCustodyCurrency(value: unknown): CustodyCurrency {
  return value === "ARS" ? "ARS" : "USD";
}

/** Monto opcional: null si viene vacío; error si no es un número ≥ 0. */
export function parseEnvelopeAmount(value: unknown, what: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new Error(`El monto ${what} no es válido`);
  return n === 0 ? null : n;
}

export function custodyEnvelopes(p: {
  reservationAmount: number | null;
  reservationCurrency: string;
  hasReinforcement: boolean;
  reinforcementAmount: number | null;
  reinforcementCurrency: string;
}): Envelope[] {
  const out: Envelope[] = [];
  if (p.reservationAmount && p.reservationAmount > 0) {
    out.push({ number: 1, kind: "reserva", amount: p.reservationAmount, currency: toCustodyCurrency(p.reservationCurrency) });
  }
  if (p.hasReinforcement && p.reinforcementAmount && p.reinforcementAmount > 0) {
    out.push({ number: 2, kind: "refuerzo", amount: p.reinforcementAmount, currency: toCustodyCurrency(p.reinforcementCurrency) });
  }
  return out;
}

/** "US$ 3.000" o, si hay monedas mezcladas, "US$ 1.000 + $ 500.000". */
export function custodyTotal(envelopes: Envelope[]): string {
  const sums = new Map<CustodyCurrency, number>();
  for (const e of envelopes) sums.set(e.currency, (sums.get(e.currency) ?? 0) + e.amount);
  return (["USD", "ARS"] as const)
    .filter((c) => sums.has(c))
    .map((c) => formatMoney(sums.get(c)!, c))
    .join(" + ");
}

/** "2 sobres · US$ 3.000" (vacío si no hay sobres con monto). */
export function describeCustody(envelopes: Envelope[]): string {
  if (envelopes.length === 0) return "";
  return `${envelopes.length} ${envelopes.length === 1 ? "sobre" : "sobres"} · ${custodyTotal(envelopes)}`;
}
