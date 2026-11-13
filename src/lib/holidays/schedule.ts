import { DateTime } from "luxon";

const TZ = "America/Argentina/Buenos_Aires";

/**
 * ¿Toca chequear feriados? Los lunes desde las 8:00 (hora AR), si todavía no
 * hubo una corrida buena ese lunes.
 */
export function mondayHolidaysDue(now: Date, lastOkRun: Date | null): boolean {
  const ar = DateTime.fromJSDate(now, { zone: TZ });
  if (ar.weekday !== 1 || ar.hour < 8) return false;
  if (!lastOkRun) return true;
  return DateTime.fromJSDate(lastOkRun, { zone: TZ }) < ar.startOf("day");
}
