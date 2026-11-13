import { DateTime } from "luxon";

export const RESERVATION_DAY_TYPES = ["business", "calendar"] as const;
export type ReservationDayType = (typeof RESERVATION_DAY_TYPES)[number];

export const RESERVATION_DAY_TYPE_LABEL: Record<ReservationDayType, string> = {
  business: "Días hábiles",
  calendar: "Días corridos",
};

export const RESERVATION_REMINDER_OFFSETS = [15, 5, 0] as const;

/** Qué vence: la reserva o su refuerzo. */
export const EXPIRY_KINDS = ["reserva", "refuerzo"] as const;
export type ExpiryKind = (typeof EXPIRY_KINDS)[number];

export const EXPIRY_KIND_LABEL: Record<ExpiryKind, string> = {
  reserva: "Reserva",
  refuerzo: "Refuerzo",
};

export function isExpiryKind(value: unknown): value is ExpiryKind {
  return typeof value === "string" && (EXPIRY_KINDS as readonly string[]).includes(value);
}

export function buildReservationReminderDates(expiresAt: Date, kind: ExpiryKind = "reserva") {
  const expiry = DateTime.fromJSDate(expiresAt, { zone: "utc" }).startOf("day");
  return RESERVATION_REMINDER_OFFSETS.map((offsetDays) => ({
    kind,
    offsetDays,
    scheduledFor: expiry.minus({ days: offsetDays }).toJSDate(),
  }));
}

export interface ResolvedTerm {
  date: Date;
  termDays: number;
  dayType: ReservationDayType;
  expiresAt: Date;
}

/**
 * Valida fecha + cantidad + tipo de días y calcula el vencimiento.
 * `label` arma los mensajes ("la reserva", "el refuerzo"). Lanza Error con un
 * mensaje listo para mostrar.
 */
/** "de la reserva" / "del refuerzo". */
export function deLabel(label: string): string {
  return label.startsWith("el ") ? `del ${label.slice(3)}` : `de ${label}`;
}

export function resolveTerm(
  input: { date: unknown; termDays: unknown; dayType: unknown },
  label: string,
  calendar?: HolidayCalendar | null,
): ResolvedTerm {
  const { date, termDays, dayType } = input;
  if (!(typeof date === "string" || date instanceof Date) || (typeof date === "string" && !date.trim())) {
    throw new Error(`Ingresá la fecha ${deLabel(label)}`);
  }
  if (!Number.isInteger(termDays) || (termDays as number) <= 0 || (termDays as number) > 3650) {
    throw new Error(`La vigencia ${deLabel(label)} debe ser un número entero entre 1 y 3650`);
  }
  if (!isReservationDayType(dayType)) {
    throw new Error(`Elegí si la vigencia ${deLabel(label)} es en días hábiles o corridos`);
  }
  const expiresAt = calculateReservationExpiration(
    typeof date === "string" ? date.slice(0, 10) : date,
    termDays as number,
    dayType,
    calendar,
  );
  const parsedDate = date instanceof Date ? date : new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  return { date: parsedDate, termDays: termDays as number, dayType, expiresAt };
}

/**
 * Vencimiento para mostrar mientras se completa el formulario. Devuelve null si
 * los datos todavía no alcanzan (sin fecha, días vacíos, etc.). El backend
 * siempre recalcula: esto es solo una vista previa.
 */
export function previewExpiration(
  date: string,
  termDays: string | number,
  dayType: ReservationDayType,
  calendar?: HolidayCalendar | null,
): Date | null {
  const term = typeof termDays === "number" ? termDays : Number(termDays);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.slice(0, 10)) || !Number.isInteger(term) || term <= 0 || term > 3650) {
    return null;
  }
  try {
    return calculateReservationExpiration(date.slice(0, 10), term, dayType, calendar);
  } catch {
    return null;
  }
}

/** "lunes 11 de enero de 2027" para una fecha pura (medianoche UTC). */
export function formatExpiryLong(date: Date | string): string {
  const dt = typeof date === "string"
    ? DateTime.fromISO(date.slice(0, 10), { zone: "utc" })
    : DateTime.fromJSDate(date, { zone: "utc" });
  return dt.setLocale("es").toFormat("cccc d 'de' LLLL 'de' yyyy");
}

/** Fechas de los avisos (15 días, 5 días, el día) en dd/MM para la vista previa. */
export function reminderDatesShort(expiresAt: Date): string[] {
  return buildReservationReminderDates(expiresAt).map((r) =>
    DateTime.fromJSDate(r.scheduledFor, { zone: "utc" }).toFormat("dd/MM"),
  );
}

export function isReservationDayType(value: unknown): value is ReservationDayType {
  return typeof value === "string" && (RESERVATION_DAY_TYPES as readonly string[]).includes(value);
}

function isoDate(month: number, day: number, year: number): string {
  return DateTime.utc(year, month, day).toISODate()!;
}

/** Meeus/Jones/Butcher Gregorian Easter calculation. */
function easterSunday(year: number): DateTime {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return DateTime.utc(year, month, day);
}

function transferredHoliday(year: number, month: number, day: number): DateTime {
  const original = DateTime.utc(year, month, day);
  if (original.weekday === 2 || original.weekday === 3) return original.startOf("week");
  if (original.weekday === 4 || original.weekday === 5) return original.plus({ weeks: 1 }).startOf("week");
  return original;
}

// Días turísticos publicados oficialmente. Los años futuros se agregan cuando
// Jefatura de Gabinete emite el calendario correspondiente.
const TOURISM_DAYS: Record<number, readonly string[]> = {
  2024: ["2024-04-01", "2024-06-21", "2024-10-11"],
  2025: ["2025-05-02", "2025-08-15", "2025-11-21"],
  2026: ["2026-03-23", "2026-07-10", "2026-12-07"],
};

const SPECIAL_TRANSFERS: Record<number, readonly string[]> = {
  // Decreto 614/2025 + Resolución 139/2025: el 12/10/2025 se trasladó al 10/10.
  2025: ["2025-10-10"],
};

// Feriados excepcionales que cuenta el Colegio de Escribanos (PBA).
const SPECIAL_DAYS: Record<number, readonly string[]> = {
  // Visita del Papa León XIV: 9/11 nacional y 11/11 en Provincia de Buenos Aires.
  2026: ["2026-11-09", "2026-11-11"],
};

/**
 * Respaldo propio, igual al criterio del Colegio de Escribanos de la Provincia
 * de Buenos Aires (feriados nacionales, Jueves Santo, días no laborables con
 * fines turísticos y feriados provinciales excepcionales). Solo se usa fuera
 * del rango que ya se bajó de la calculadora del Colegio (ver HolidayCalendar).
 */
export function ruleHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const days = new Set<string>([
    isoDate(1, 1, year),
    isoDate(3, 24, year),
    isoDate(4, 2, year),
    isoDate(5, 1, year),
    isoDate(5, 25, year),
    isoDate(6, 20, year),
    isoDate(7, 9, year),
    isoDate(12, 8, year),
    isoDate(12, 25, year),
    easter.minus({ days: 48 }).toISODate()!, // lunes de Carnaval
    easter.minus({ days: 47 }).toISODate()!, // martes de Carnaval
    easter.minus({ days: 3 }).toISODate()!, // Jueves Santo
    easter.minus({ days: 2 }).toISODate()!, // Viernes Santo
  ]);

  for (const [month, day] of [[6, 17], [8, 17], [10, 12], [11, 20]] as const) {
    // Octubre 2025 tuvo un traslado excepcional definido arriba.
    if (year === 2025 && month === 10 && day === 12) continue;
    days.add(transferredHoliday(year, month, day).toISODate()!);
  }
  for (const date of TOURISM_DAYS[year] ?? []) days.add(date);
  for (const date of SPECIAL_TRANSFERS[year] ?? []) days.add(date);
  for (const date of SPECIAL_DAYS[year] ?? []) days.add(date);
  return days;
}

/**
 * Feriados bajados de la calculadora del Colegio para un rango. Dentro de
 * [from, to] mandan estos; afuera, las reglas propias. Serializable para
 * pasarlo al navegador (vista previa).
 */
export interface HolidayCalendar {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  days: string[]; // YYYY-MM-DD
}

function holidayChecker(calendar?: HolidayCalendar | null) {
  const synced = calendar ? new Set(calendar.days) : null;
  const byYear = new Map<number, Set<string>>();
  return (iso: string, year: number) => {
    if (calendar && synced && iso >= calendar.from && iso <= calendar.to) return synced.has(iso);
    let rules = byYear.get(year);
    if (!rules) {
      rules = ruleHolidays(year);
      byYear.set(year, rules);
    }
    return rules.has(iso);
  };
}

export function calculateReservationExpiration(
  reservationDate: string | Date,
  termDays: number,
  dayType: ReservationDayType,
  calendar?: HolidayCalendar | null,
): Date {
  if (!Number.isInteger(termDays) || termDays <= 0 || termDays > 3650) {
    throw new Error("La vigencia debe ser un número entero entre 1 y 3650");
  }
  if (!isReservationDayType(dayType)) throw new Error("Tipo de días inválido");

  if (typeof reservationDate === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(reservationDate)) {
    throw new Error("La fecha de reserva debe tener formato YYYY-MM-DD");
  }
  const start = typeof reservationDate === "string"
    ? DateTime.fromISO(reservationDate, { zone: "utc" })
    : DateTime.fromJSDate(reservationDate, { zone: "utc" }).startOf("day");
  if (!start.isValid) throw new Error("Fecha de reserva inválida");

  if (dayType === "calendar") return start.plus({ days: termDays }).toJSDate();

  const isHoliday = holidayChecker(calendar);
  let cursor = start;
  let counted = 0;
  while (counted < termDays) {
    cursor = cursor.plus({ days: 1 });
    if (cursor.weekday >= 6) continue;
    if (isHoliday(cursor.toISODate()!, cursor.year)) continue;
    counted += 1;
  }
  return cursor.toJSDate();
}
