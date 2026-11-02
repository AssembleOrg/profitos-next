/**
 * Cálculos de un cobro de alquiler tradicional: líneas de conceptos, honorarios
 * de administración y reparto inquilino / propietario. Puro (sin DB) para que
 * lo usen igual la hoja de cobro (vista previa en vivo) y el server.
 *
 * Regla de la planilla de la inmobiliaria:
 *   total inquilino   = alquiler + municipal + servicios + otros
 *                       (cualquier concepto salvo el alquiler puede restar: monto negativo)
 *   honorarios        = % sobre el alquiler (default 5%); un concepto entra en la
 *                       base solo si se marca a mano (affectsFee)
 *   neto propietario  = total inquilino − honorarios
 */

/** rent = alquiler · additional = municipal/servicios del contrato · extra = punitorios, diferencias, otros */
export type ChargeLineKind = "rent" | "additional" | "extra";

export interface ChargeLine {
  kind: ChargeLineKind;
  label: string;
  amount: number;
  /** id de RentalContractAdditional cuando kind = "additional" */
  refId?: string | null;
  /** El concepto (sume o reste) entra en la base de honorarios. Por defecto no. */
  affectsFee?: boolean;
}

export interface ChargeSplit {
  tenantTotal: number;
  feeBase: number;
  feePercent: number;
  feeAmount: number;
  ownerTotal: number;
}

export const DEFAULT_FEE_PERCENT = 5;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function sanitizeFeePercent(value: unknown, fallback = DEFAULT_FEE_PERCENT): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return round2(n);
}

/** Honorarios sobre el alquiler; el resto de los conceptos, sume o reste, pasa entero al propietario salvo que tenga affectsFee. */
export function splitCharges(lines: ChargeLine[], feePercent: number): ChargeSplit {
  const tenantTotal = round2(lines.reduce((acc, l) => acc + (Number.isFinite(l.amount) ? l.amount : 0), 0));
  const feeBase = Math.max(0, round2(lines.filter((l) => l.kind === "rent" || l.affectsFee).reduce((acc, l) => acc + l.amount, 0)));
  const pct = sanitizeFeePercent(feePercent, 0);
  const feeAmount = round2((feeBase * pct) / 100);
  return { tenantTotal, feeBase, feePercent: pct, feeAmount, ownerTotal: round2(tenantTotal - feeAmount) };
}

/** Limpia las líneas que llegan del cliente: sin vacías, montos finitos, labels recortados. */
export function sanitizeChargeLines(raw: unknown): ChargeLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ChargeLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const kind = r.kind === "rent" || r.kind === "additional" || r.kind === "extra" ? r.kind : null;
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 80) : "";
    const amount = typeof r.amount === "number" && Number.isFinite(r.amount) ? round2(r.amount) : Number.NaN;
    if (!kind || !label || !Number.isFinite(amount)) continue;
    out.push({ kind, label, amount, refId: typeof r.refId === "string" ? r.refId : null, affectsFee: r.affectsFee === true });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Número de recibo: 0001-00004608
// ──────────────────────────────────────────────────────────────────

export function formatReceiptNo(pointOfSale: number, number: number): string {
  return `${String(pointOfSale).padStart(4, "0")}-${String(number).padStart(8, "0")}`;
}

// ──────────────────────────────────────────────────────────────────
// Monto en letras (recibos): "UN MILLÓN CINCO MIL TRESCIENTOS CUARENTA Y CINCO"
// ──────────────────────────────────────────────────────────────────

const UNITS = [
  "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
  "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];
const TENS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const HUNDREDS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

function below100(n: number): string {
  if (n < 30) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? TENS[t] : `${TENS[t]} Y ${UNITS[u]}`;
}

function below1000(n: number): string {
  if (n === 100) return "CIEN";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [HUNDREDS[h], rest ? below100(rest) : ""].filter(Boolean).join(" ");
}

/** "UNO" → "UN" delante de MIL / MILLÓN ("VEINTIUNO" → "VEINTIÚN"). */
function apocope(words: string): string {
  return words.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");
}

function integerToWords(n: number): string {
  if (n === 0) return "CERO";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    parts.push(millions === 1 ? "UN MILLÓN" : `${apocope(integerToWords(millions))} MILLONES`);
  }
  if (thousands) {
    parts.push(thousands === 1 ? "MIL" : `${apocope(below1000(thousands))} MIL`);
  }
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

/** "PESOS UN MILLÓN CINCO MIL TRESCIENTOS CUARENTA Y CINCO CON 00/100" */
export function amountInWords(amount: number, currency: string = "ARS"): string {
  const safe = Math.max(0, Math.round(amount * 100));
  const integer = Math.floor(safe / 100);
  const cents = safe % 100;
  const prefix = currency === "USD" ? "DÓLARES" : "PESOS";
  return `${prefix} ${integerToWords(integer)} CON ${String(cents).padStart(2, "0")}/100`;
}
