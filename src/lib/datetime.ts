import { DateTime, Settings } from "luxon";

const TIMEZONE = "America/Argentina/Buenos_Aires";

Settings.defaultZone = TIMEZONE;

export function now() {
  return DateTime.now().setZone(TIMEZONE);
}

export function fromISO(iso: string) {
  return DateTime.fromISO(iso, { zone: TIMEZONE });
}

export function fromJSDate(date: Date) {
  return DateTime.fromJSDate(date, { zone: TIMEZONE });
}

/** Visual format for user: DD/MM/YYYY */
const VISUAL_DATE_FORMAT = "dd/MM/yyyy";

export function formatDate(date: Date | string) {
  const dt = typeof date === "string" ? fromISO(date) : fromJSDate(date);
  return dt.toFormat(VISUAL_DATE_FORMAT);
}

export function formatDateTime(date: Date | string) {
  const dt = typeof date === "string" ? fromISO(date) : fromJSDate(date);
  return dt.toFormat(`${VISUAL_DATE_FORMAT} · HH:mm`);
}

/**
 * Parse a visual date string (DD/MM/YYYY or DD-MM-YYYY) to ISO date (YYYY-MM-DD) for API/store.
 * Returns the same string if it already looks like ISO (YYYY-MM-DD).
 */
export function parseVisualDate(visual: string): string {
  const trimmed = visual.trim();
  if (!trimmed) return trimmed;
  // Already ISO (e.g. from type="date" or API)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const dt = DateTime.fromFormat(trimmed, "dd/MM/yyyy", { zone: TIMEZONE });
  if (dt.isValid) return dt.toISODate() ?? trimmed;
  const dtAlt = DateTime.fromFormat(trimmed, "dd-MM-yyyy", { zone: TIMEZONE });
  if (dtAlt.isValid) return dtAlt.toISODate() ?? trimmed;
  return trimmed;
}

export function formatTime(date: Date | string) {
  const dt = typeof date === "string" ? fromISO(date) : fromJSDate(date);
  return dt.toFormat("HH:mm");
}

export function formatRelative(date: Date | string) {
  const dt = typeof date === "string" ? fromISO(date) : fromJSDate(date);
  return dt.toRelative({ locale: "es" }) ?? "";
}

export { DateTime, TIMEZONE };
