import { DateTime, fromISO, fromJSDate, now } from "@/lib/datetime";

// ──────────────────────────────────────────────────────────────────
// Frequencies
// ──────────────────────────────────────────────────────────────────

export const RENTAL_FREQUENCIES = [
  "diario",
  "semanal",
  "quincenal",
  "mensual",
  "bimestral",
  "trimestral",
] as const;

export type RentalFrequency = (typeof RENTAL_FREQUENCIES)[number];

export function isRentalFrequency(value: unknown): value is RentalFrequency {
  return typeof value === "string" && (RENTAL_FREQUENCIES as readonly string[]).includes(value);
}

export const RENTAL_FREQUENCY_LABEL: Record<RentalFrequency, string> = {
  diario: "Diario",
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
};

/** Devuelve el `dueDate` siguiente al actual según la frecuencia. */
export function nextDueDate(prev: DateTime, frequency: RentalFrequency): DateTime {
  switch (frequency) {
    case "diario":
      return prev.plus({ days: 1 });
    case "semanal":
      return prev.plus({ weeks: 1 });
    case "quincenal":
      return prev.plus({ days: 15 });
    case "mensual":
      return prev.plus({ months: 1 });
    case "bimestral":
      return prev.plus({ months: 2 });
    case "trimestral":
      return prev.plus({ months: 3 });
  }
}

// ──────────────────────────────────────────────────────────────────
// Statuses (manuales) + estado efectivo (derivado o manual)
// ──────────────────────────────────────────────────────────────────

export const RENTAL_DUE_STATUSES_MANUAL = [
  "pagado",
  "parcial",
  "condonado",
] as const;

export type RentalDueManualStatus = (typeof RENTAL_DUE_STATUSES_MANUAL)[number];

export type RentalDueEffectiveStatus =
  | "esperando"
  | "vencido"
  | RentalDueManualStatus;

export const RENTAL_DUE_STATUS_LABEL: Record<RentalDueEffectiveStatus, string> = {
  esperando: "A vencer",
  vencido: "Vencido",
  pagado: "Pagado",
  parcial: "Parcial",
  condonado: "Condonado",
};

export const RENTAL_DUE_STATUS_STYLE: Record<
  RentalDueEffectiveStatus,
  { dot: string; chip: string }
> = {
  esperando: {
    dot: "bg-text-faint",
    chip: "border-border-strong bg-surface text-text-muted",
  },
  vencido: {
    dot: "bg-red-400",
    chip: "border-red-500/40 bg-red-500/10 text-red-300",
  },
  pagado: {
    dot: "bg-emerald-400",
    chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  parcial: {
    dot: "bg-amber-400",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  condonado: {
    dot: "bg-violet-400",
    chip: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  },
};

export function isManualDueStatus(value: unknown): value is RentalDueManualStatus {
  return (
    typeof value === "string" &&
    (RENTAL_DUE_STATUSES_MANUAL as readonly string[]).includes(value)
  );
}

interface DueStatusInput {
  dueDate: Date | string;
  status: string | null;
  gracePeriodDays: number;
  /** Importe esperado de la cuota (con adicionales). Necesario para derivar por pagos. */
  expectedAmount?: number;
  /** Suma de lo efectivamente cobrado en la cuota. Necesario para derivar por pagos. */
  collected?: number;
}

/**
 * Calcula el estado efectivo de un vencimiento.
 * - Si tiene `status` manual, gana.
 * - Si hay pagos registrados que cubren la cuota → `pagado`; si la cubren en
 *   parte → `parcial` (aunque no se haya marcado a mano).
 * - Si no hay pagos y la fecha + grace ya pasó → `vencido`.
 * - Si todavía no llegó → `esperando`.
 */
export function getDueEffectiveStatus(input: DueStatusInput): RentalDueEffectiveStatus {
  if (input.status && isManualDueStatus(input.status)) return input.status;

  // Derivar por pagos efectivos (cuando se pasan expectedAmount + collected).
  if (input.collected !== undefined && input.collected > 0) {
    if (input.expectedAmount !== undefined && input.collected >= input.expectedAmount) {
      return "pagado";
    }
    return "parcial";
  }

  const today = now().startOf("day");
  const dt =
    typeof input.dueDate === "string"
      ? fromISO(input.dueDate)
      : fromJSDate(input.dueDate);
  const cutoff = dt.startOf("day").plus({ days: input.gracePeriodDays });
  if (today > cutoff) return "vencido";
  return "esperando";
}

// ──────────────────────────────────────────────────────────────────
// Generación de vencimientos (cuotas)
// ──────────────────────────────────────────────────────────────────

export interface GenerateDueDatesInput {
  startDate: Date | string;
  endDate: Date | string;
  firstDueDate: Date | string;
  frequency: RentalFrequency;
  /** Importe esperado en cada cuota (sin adicionales). Los adicionales se suman aparte. */
  baseAmount: number;
  /** Hard cap para evitar crear miles de cuotas por error. */
  maxCount?: number;
}

export interface GeneratedDueDate {
  position: number;
  dueDate: string; // YYYY-MM-DD
  expectedAmount: number;
}

/**
 * Genera la lista de cuotas dado un contrato.
 * La PRIMERA cuota cae en `firstDueDate`. Las siguientes se calculan sumando la
 * frecuencia, mientras la fecha quede dentro del rango contractual.
 */
export function generateDueDates(input: GenerateDueDatesInput): GeneratedDueDate[] {
  const { frequency, baseAmount, maxCount = 240 } = input;
  const start =
    typeof input.startDate === "string" ? fromISO(input.startDate) : fromJSDate(input.startDate);
  const end =
    typeof input.endDate === "string" ? fromISO(input.endDate) : fromJSDate(input.endDate);
  const first =
    typeof input.firstDueDate === "string"
      ? fromISO(input.firstDueDate)
      : fromJSDate(input.firstDueDate);

  if (!start.isValid || !end.isValid || !first.isValid) return [];
  if (start > end) return [];

  const result: GeneratedDueDate[] = [];
  let current = first.startOf("day");
  let position = 1;
  const endCutoff = end.startOf("day");

  while (current <= endCutoff && result.length < maxCount) {
    result.push({
      position,
      dueDate: current.toISODate() ?? "",
      expectedAmount: baseAmount,
    });
    current = nextDueDate(current, frequency);
    position++;
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────
// Argentine currency formatting
// ──────────────────────────────────────────────────────────────────

const arNumberFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const arDecimalFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatARS(amount: number, opts: { decimals?: boolean } = {}): string {
  const formatter = opts.decimals ? arDecimalFormatter : arNumberFormatter;
  return `$ ${formatter.format(amount)}`;
}

export function formatARNumber(amount: number, opts: { decimals?: boolean } = {}): string {
  const formatter = opts.decimals ? arDecimalFormatter : arNumberFormatter;
  return formatter.format(amount);
}

/** Parsea una cadena con separadores AR ("1.234.567,89") a número. */
export function parseARNumber(value: string): number {
  if (!value) return 0;
  const normalized = value
    .replaceAll(/[^\d,.-]/g, "")
    .replaceAll(".", "")
    .replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

// ──────────────────────────────────────────────────────────────────
// Filename slugify (sin tildes ni ñ)
// ──────────────────────────────────────────────────────────────────

export function slugifyFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll(/ñ/gi, "n")
    .replaceAll(/[^a-zA-Z0-9._-]/g, "_")
    .replaceAll(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ──────────────────────────────────────────────────────────────────
// Contract aggregation helpers
// ──────────────────────────────────────────────────────────────────

interface DueDateForAggregation {
  expectedAmount: number;
  status: string | null;
  dueDate: Date | string;
  transactions?: Array<{ amountPaid: number; commissionAmount: number; ownerAmount: number }>;
}

/**
 * Resume, para una colección de cuotas: total esperado, cobrado, pendiente,
 * y conteo por estado efectivo.
 */
export function summarizeDueDates(
  dueDates: DueDateForAggregation[],
  gracePeriodDays = 0,
) {
  let expectedTotal = 0;
  let collectedTotal = 0;
  let commissionTotal = 0;
  let ownerTotal = 0;
  const counts: Record<RentalDueEffectiveStatus, number> = {
    esperando: 0,
    vencido: 0,
    pagado: 0,
    parcial: 0,
    condonado: 0,
  };
  for (const due of dueDates) {
    expectedTotal += due.expectedAmount;
    let dueCollected = 0;
    for (const tx of due.transactions ?? []) {
      dueCollected += tx.amountPaid;
      commissionTotal += tx.commissionAmount;
      ownerTotal += tx.ownerAmount;
    }
    collectedTotal += dueCollected;
    const eff = getDueEffectiveStatus({
      dueDate: due.dueDate,
      status: due.status,
      gracePeriodDays,
      expectedAmount: due.expectedAmount,
      collected: dueCollected,
    });
    counts[eff]++;
  }
  return { expectedTotal, collectedTotal, commissionTotal, ownerTotal, counts };
}

export type { DateTime };
