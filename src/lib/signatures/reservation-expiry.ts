import { DateTime } from "luxon";

export const RESERVATION_DAY_TYPES = ["business", "calendar"] as const;
export type ReservationDayType = (typeof RESERVATION_DAY_TYPES)[number];

export const RESERVATION_DAY_TYPE_LABEL: Record<ReservationDayType, string> = {
  business: "Días hábiles",
  calendar: "Días corridos",
};

export const RESERVATION_REMINDER_OFFSETS = [15, 5, 0] as const;

export function buildReservationReminderDates(expiresAt: Date) {
  const expiry = DateTime.fromJSDate(expiresAt, { zone: "utc" }).startOf("day");
  return RESERVATION_REMINDER_OFFSETS.map((offsetDays) => ({
    offsetDays,
    scheduledFor: expiry.minus({ days: offsetDays }).toJSDate(),
  }));
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

export function argentinaQuilmesHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const days = new Set<string>([
    isoDate(1, 1, year),
    isoDate(3, 24, year),
    isoDate(4, 2, year),
    isoDate(5, 1, year),
    isoDate(5, 25, year),
    isoDate(6, 20, year),
    isoDate(7, 9, year),
    isoDate(8, 14, year), // Aniversario/Día de Quilmes
    isoDate(12, 8, year),
    isoDate(12, 25, year),
    easter.minus({ days: 48 }).toISODate()!, // lunes de Carnaval
    easter.minus({ days: 47 }).toISODate()!, // martes de Carnaval
    easter.minus({ days: 2 }).toISODate()!, // Viernes Santo
  ]);

  for (const [month, day] of [[6, 17], [8, 17], [10, 12], [11, 20]] as const) {
    // Octubre 2025 tuvo un traslado excepcional definido arriba.
    if (year === 2025 && month === 10 && day === 12) continue;
    days.add(transferredHoliday(year, month, day).toISODate()!);
  }
  for (const date of TOURISM_DAYS[year] ?? []) days.add(date);
  for (const date of SPECIAL_TRANSFERS[year] ?? []) days.add(date);
  return days;
}

export function calculateReservationExpiration(
  reservationDate: string | Date,
  termDays: number,
  dayType: ReservationDayType,
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

  const holidaysByYear = new Map<number, Set<string>>();
  let cursor = start;
  let counted = 0;
  while (counted < termDays) {
    cursor = cursor.plus({ days: 1 });
    if (cursor.weekday >= 6) continue;
    let holidays = holidaysByYear.get(cursor.year);
    if (!holidays) {
      holidays = argentinaQuilmesHolidays(cursor.year);
      holidaysByYear.set(cursor.year, holidays);
    }
    if (holidays.has(cursor.toISODate()!)) continue;
    counted += 1;
  }
  return cursor.toJSDate();
}
