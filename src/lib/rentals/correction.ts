/**
 * Corrección de un cobro ya emitido (cambia los montos de sus recibos sin
 * anular los números). Puro, sin DB: lo usan el server, el legajo y los tests.
 *
 * Regla de la inmobiliaria: las primeras 96 horas se corrige libremente;
 * después se puede igual, pero hay que dejar el motivo. Toda corrección queda
 * guardada (quién, cuándo, antes y después), dentro o fuera de plazo.
 */
import { formatARNumber } from "@/lib/rentals";
import type { ChargeLine, ChargeSplit } from "./money";

export const CORRECTION_FREE_HOURS = 96;

/** Estado de un cobro en un momento dado: lo que se imprime en sus recibos. */
export interface PaymentSnapshot {
  lines: ChargeLine[];
  split: ChargeSplit;
  receiptNotes: string | null;
}

export interface PaymentCorrection {
  /** ISO. */
  at: string;
  byUserId: string;
  byName: string;
  /** Horas enteras entre que se registró el cobro y la corrección. */
  hoursAfterIssue: number;
  /** Se corrigió pasadas las 96 horas. */
  late: boolean;
  reason: string | null;
  /** El propietario ya había retirado su parte cuando se corrigió. */
  ownerAlreadyPaid: boolean;
  before: PaymentSnapshot;
  after: PaymentSnapshot;
}

export function hoursSince(issuedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - issuedAt.getTime()) / 3_600_000));
}

export function isLateCorrection(issuedAt: Date, now: Date): boolean {
  return now.getTime() - issuedAt.getTime() > CORRECTION_FREE_HOURS * 3_600_000;
}

function cents(n: number) {
  return Math.round(n * 100);
}

function lineKey(l: ChargeLine) {
  return `${l.kind}|${l.refId ?? ""}|${l.label.trim().toLowerCase()}`;
}

function sameLines(a: ChargeLine[], b: ChargeLine[]) {
  if (a.length !== b.length) return false;
  return a.every((l, i) => {
    const o = b[i];
    return lineKey(l) === lineKey(o) && cents(l.amount) === cents(o.amount) && Boolean(l.affectsFee) === Boolean(o.affectsFee);
  });
}

/** true = la corrección no cambia nada de lo que sale en los recibos. */
export function sameSnapshot(a: PaymentSnapshot, b: PaymentSnapshot): boolean {
  return (
    sameLines(a.lines, b.lines) &&
    cents(a.split.feePercent) === cents(b.split.feePercent) &&
    (a.receiptNotes ?? "").trim() === (b.receiptNotes ?? "").trim()
  );
}

function money(amount: number, currency: string) {
  const sign = amount < 0 ? "− " : "";
  return `${sign}${currency === "USD" ? "U$D" : "$"} ${formatARNumber(Math.abs(amount), { decimals: true })}`;
}

function pct(n: number) {
  return `${String(Math.round(n * 100) / 100).replace(".", ",")}%`;
}

/**
 * Qué cambió, en una línea legible para el historial:
 * "Total U$D 1.200,00 → U$D 1.100,00 · Alquiler U$D 1.200,00 → U$D 1.100,00".
 */
export function correctionSummary(c: Pick<PaymentCorrection, "before" | "after">, currency: string): string {
  const parts: string[] = [];
  const { before, after } = c;
  if (cents(before.split.tenantTotal) !== cents(after.split.tenantTotal)) {
    parts.push(`Total ${money(before.split.tenantTotal, currency)} → ${money(after.split.tenantTotal, currency)}`);
  }
  const prev = new Map(before.lines.map((l) => [lineKey(l), l]));
  const seen = new Set<string>();
  for (const l of after.lines) {
    const key = lineKey(l);
    seen.add(key);
    const old = prev.get(key);
    if (!old) parts.push(`se agregó ${l.label} ${money(l.amount, currency)}`);
    else if (cents(old.amount) !== cents(l.amount)) parts.push(`${l.label} ${money(old.amount, currency)} → ${money(l.amount, currency)}`);
    else if (Boolean(old.affectsFee) !== Boolean(l.affectsFee)) parts.push(`${l.label} ${l.affectsFee ? "pasa a contar" : "deja de contar"} para honorarios`);
  }
  for (const l of before.lines) {
    if (!seen.has(lineKey(l))) parts.push(`se quitó ${l.label} ${money(l.amount, currency)}`);
  }
  if (cents(before.split.feePercent) !== cents(after.split.feePercent)) {
    parts.push(`honorarios ${pct(before.split.feePercent)} → ${pct(after.split.feePercent)}`);
  }
  if (cents(before.split.ownerTotal) !== cents(after.split.ownerTotal)) {
    parts.push(`neto propietario ${money(before.split.ownerTotal, currency)} → ${money(after.split.ownerTotal, currency)}`);
  }
  if ((before.receiptNotes ?? "").trim() !== (after.receiptNotes ?? "").trim()) parts.push("cambiaron las observaciones");
  return parts.join(" · ");
}

/** Lee el historial guardado en el desglose del cobro, tolerando datos viejos o rotos. */
export function readCorrections(breakdown: unknown): PaymentCorrection[] {
  const raw = (breakdown as { corrections?: unknown } | null)?.corrections;
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is PaymentCorrection => Boolean(c) && typeof c === "object" && typeof (c as PaymentCorrection).at === "string" && Boolean((c as PaymentCorrection).before?.split) && Boolean((c as PaymentCorrection).after?.split));
}
