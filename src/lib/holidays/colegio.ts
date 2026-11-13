// Calculadora de fechas del Colegio de Escribanos de la Provincia de Buenos
// Aires (https://www.colescba.org.ar/portal/calculadora-de-fechas). Es pública:
// la página la llama sin sesión ("Bearer null"). Se usa una vez por semana.

const API = "https://api.colescba.org.ar/wordpress/api/colescba/calculadora-fechas/calcular-fecha";

export interface ColegioHoliday {
  day: string; // YYYY-MM-DD
  description: string;
}

export interface ColegioRange {
  from: string;
  to: string;
  /** Hasta dónde tiene cargados feriados el Colegio. */
  lastPossibleDate: string | null;
  holidays: ColegioHoliday[];
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type ColegioBody = {
  result_calculadora?: { to?: string; lastPossibleDate?: string; nonWorkingDays?: { day?: string; description?: string }[] };
};

async function ask(start: string, days: number): Promise<ColegioBody> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer null",
      Origin: "https://www.colescba.org.ar",
      Referer: "https://www.colescba.org.ar/portal/calculadora-de-fechas",
    },
    body: JSON.stringify({ "input-date-start": start, tipo: "CALENDAR_DAYS", dias: String(days) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`La calculadora del Colegio respondió ${res.status}`);
  return (await res.json()) as ColegioBody;
}

/**
 * Feriados del Colegio entre `from` y `to` (ambos incluidos, como en su
 * calculadora). Si `to` pasa del último día que el Colegio tiene cargado, se
 * recorta ahí (devuelve el `to` real cubierto).
 */
export async function fetchColegioHolidays(from: string, to: string): Promise<ColegioRange> {
  let end = to;
  let body = await ask(from, Math.max(1, daysBetween(from, end)));
  if (!Array.isArray(body.result_calculadora?.nonWorkingDays)) {
    // Su servidor falla si el rango pasa de lastPossibleDate: se averigua y se recorta.
    const probe = await ask(from, 1);
    const last = probe.result_calculadora?.lastPossibleDate;
    if (!last || !/^\d{4}-\d{2}-\d{2}$/.test(last)) throw new Error("La calculadora del Colegio devolvió algo inesperado");
    // El fin tiene que quedar antes del último día cargado ("no puede ser posterior").
    const lastUsable = new Date(Date.parse(`${last}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    if (lastUsable < from) return { from, to: from, lastPossibleDate: last, holidays: [] };
    end = lastUsable < end ? lastUsable : end;
    body = await ask(from, Math.max(1, daysBetween(from, end)));
  }
  const result = body.result_calculadora;
  if (!result || !Array.isArray(result.nonWorkingDays)) {
    throw new Error("La calculadora del Colegio devolvió algo inesperado");
  }
  const holidays = result.nonWorkingDays
    .filter((h): h is { day: string; description?: string } => typeof h.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.day))
    .filter((h) => h.day >= from && h.day <= end)
    .map((h) => ({ day: h.day, description: (h.description ?? "Feriado").trim().slice(0, 300) }));
  return { from, to: end, lastPossibleDate: result.lastPossibleDate ?? null, holidays };
}

/** Mes actual y el siguiente (lo que pidieron chequear cada lunes). */
export function currentAndNextMonth(today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastNext = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10); // último día del mes siguiente
  return { from, to: lastNext };
}
