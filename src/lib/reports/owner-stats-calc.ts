/**
 * Cuentas puras del informe al propietario (sin prisma: se testean solas).
 */

export type DayPoint = { day: string; impressions: number; views: number; leads: number };

export type MonthSummary = {
  /** "YYYY-MM" */
  month: string;
  impressions: number;
  views: number;
  leads: number;
  /** Días con dato. */
  days: number;
  /** Hay dato de TODOS los días del mes transcurridos (hasta hoy). */
  complete: boolean;
};

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Suma un mes calendario ("YYYY-MM") de la serie diaria. `todayIso` corta el mes en curso. */
export function monthSummary(points: DayPoint[], month: string, todayIso: string): MonthSummary {
  const inMonth = points.filter((p) => p.day.startsWith(`${month}-`) && p.day <= todayIso);
  const elapsed = todayIso.startsWith(`${month}-`) ? Number(todayIso.slice(8, 10)) : daysInMonth(month);
  const days = new Set(inMonth.map((p) => p.day)).size;
  return {
    month,
    impressions: inMonth.reduce((a, p) => a + p.impressions, 0),
    views: inMonth.reduce((a, p) => a + p.views, 0),
    leads: inMonth.reduce((a, p) => a + p.leads, 0),
    days,
    complete: days >= elapsed,
  };
}

type StatRow = { externalId: string; fetchedAt: Date | null; totalVisits: number | null };

/**
 * Qué aviso de ZonaProp representa a la propiedad si hay más de uno (duplicados,
 * republicaciones): primero el vinculado por la publicación, después uno
 * publicado, y entre esos el de más visitas. Sólo filas con datos traídos.
 */
export function pickPosting<T extends StatRow>(rows: T[], publicationExtId: string | null, published: Set<string>): T | null {
  const withData = rows.filter((r) => r.fetchedAt);
  if (!withData.length) return rows[0] ?? null;
  const score = (r: T) => (r.externalId === publicationExtId ? 2 : 0) + (published.has(r.externalId) ? 1 : 0);
  return [...withData].sort((a, b) => score(b) - score(a) || (b.totalVisits ?? 0) - (a.totalVisits ?? 0))[0];
}

/** "+28 %", "-31 %", "=" para la variación contra el período anterior. */
export function trendLabel(t: { pct: number; dir: "up" | "down" | "equal" } | undefined): string | null {
  if (!t) return null;
  if (t.dir === "equal") return "igual que los 30 días previos";
  const pct = Math.round(t.pct);
  if (pct === 0) return "igual que los 30 días previos";
  return `${t.dir === "up" ? "+" : "-"}${pct} % vs. 30 días previos`;
}

/** Cuántas veces más (o menos) que el promedio de avisos parecidos. */
export function vsSegment(own: number | null, segment: number | null): { ratio: number; label: string } | null {
  if (own === null || segment === null || segment <= 0) return null;
  const ratio = own / segment;
  if (ratio >= 1.15) return { ratio, label: `${ratio.toFixed(1).replace(".", ",")} veces el promedio` };
  if (ratio <= 0.85) return { ratio, label: `${Math.round((1 - ratio) * 100)} % debajo del promedio` };
  return { ratio, label: "en el promedio" };
}
