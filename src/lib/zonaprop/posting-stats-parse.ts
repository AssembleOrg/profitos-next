/**
 * Estadísticas de un aviso de ZonaProp — parte pura (sin prisma ni navegador).
 *
 * Relevado del panel "Desempeño" (bundle + respuestas reales, nov 2026). Todo
 * con el sessionid del panel, GET:
 *  - /avisos-api/panel/api/v1/statistic/posting/{id}?days=30
 *      → { impression|visit|leads|user-stat: { total, percentage, status }, userStats: { whatsapp, leadForm, viewData, socialAds, total } }
 *      percentage = variación (sin signo) contra los 30 días anteriores; status ALTO|BAJO|EQUAL da el sentido.
 *      OJO: si sube es (actual-previo)/previo, pero si BAJA es (previo-actual)/ACTUAL (verificado contra la
 *      serie semanal: "83,59 % BAJO" era una caída real de ~45 %). parseTrend lo pasa a caída real.
 *      "leads" = personas distintas; "user-stat" = contactos (WhatsApp + formulario + ver datos).
 *  - /avisos-api/panel/api/v1/statistic/posting/daily/{id}?days=30
 *      → { impressions|views|leads: { "YYYY-MM-DD": n } }
 *  - /avisos-api/panel/api/v1/statistic/posting/daily/{id}?days=90 (60 da 500)
 *      → mismas series pero SEMANALES (clave = fin de semana) + period: [{ startPeriod, endPeriod }]
 *  - /avisos-api/panel/api/v1/performance/getpostingstatistics?postingId={id}
 *      → { impressions, visits, leads, "segment-impressions", "segment-visits", "segment-leads" } (30 días, segmento = avisos parecidos)
 *  - /avisos-api/panel/api/v1/performance/getpostingvisits?postingId={id}       → n (desde que se publicó)
 *  - /avisos-api/panel/api/v1/performance/getpostingimpressions?postingId={id}  → n (desde que se publicó)
 *  - /avisos-api/panel/api/v1/performance/getpostingleads?postingId={id}        → { total, unread } (personas, desde que se publicó)
 */

export const ZP_STATS_PATHS = (id: string) => ({
  statistic: `/avisos-api/panel/api/v1/statistic/posting/${id}?days=30`,
  daily: `/avisos-api/panel/api/v1/statistic/posting/daily/${id}?days=30`,
  weekly: `/avisos-api/panel/api/v1/statistic/posting/daily/${id}?days=90`,
  performance: `/avisos-api/panel/api/v1/performance/getpostingstatistics?postingId=${id}`,
  visits: `/avisos-api/panel/api/v1/performance/getpostingvisits?postingId=${id}`,
  impressions: `/avisos-api/panel/api/v1/performance/getpostingimpressions?postingId=${id}`,
  leads: `/avisos-api/panel/api/v1/performance/getpostingleads?postingId=${id}`,
});

export type ZpStatsKey = keyof ReturnType<typeof ZP_STATS_PATHS>;
/** Respuestas crudas por endpoint (JSON ya parseado; null si falló). */
export type ZpStatsRaw = Partial<Record<ZpStatsKey, unknown>>;

export type TrendDir = "up" | "down" | "equal";
export type Trend = { pct: number; dir: TrendDir };
export type ContactChannels = { whatsapp: number; leadForm: number; viewData: number; socialAds: number };
export type DailyPoint = { day: string; impressions: number; views: number; leads: number };
export type WeekPoint = { from: string; to: string; impressions: number; views: number; leads: number };

export type PostingStats = {
  totalImpressions: number | null;
  totalVisits: number | null;
  totalLeads: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  impressions30: number | null;
  visits30: number | null;
  leads30: number | null;
  contacts30: number | null;
  contactsByChannel: ContactChannels | null;
  trend: { impressions?: Trend; visits?: Trend; leads?: Trend; contacts?: Trend } | null;
  segment: { impressions: number | null; visits: number | null; leads: number | null } | null;
  daily: DailyPoint[];
  weekly: WeekPoint[];
};

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

/** { total, percentage, status } → tendencia. Sin dato o sin período previo → undefined. */
export function parseTrend(block: unknown): Trend | undefined {
  const b = obj(block);
  if (!b) return undefined;
  const status = String(b.status ?? "").toUpperCase();
  const pct = num(b.percentage);
  if (pct === null) return undefined;
  if (status === "ALTO") return { pct: Math.abs(pct), dir: "up" };
  // ZP informa la baja relativa al valor ACTUAL: previo = actual × (1 + p) → caída real = p / (1 + p).
  if (status === "BAJO") {
    const p = Math.abs(pct) / 100;
    return { pct: Math.round((p / (1 + p)) * 10000) / 100, dir: "down" };
  }
  if (status === "EQUAL") return { pct: 0, dir: "equal" };
  return undefined;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDaily(raw: unknown): DailyPoint[] {
  const d = obj(raw);
  if (!d) return [];
  const series = (k: string) => obj(d[k]) ?? {};
  const imp = series("impressions");
  const views = series("views");
  const leads = series("leads");
  const days = new Set([...Object.keys(imp), ...Object.keys(views), ...Object.keys(leads)].filter((k) => DAY_RE.test(k)));
  return [...days].sort().map((day) => ({
    day,
    impressions: int(imp[day]) ?? 0,
    views: int(views[day]) ?? 0,
    leads: int(leads[day]) ?? 0,
  }));
}

/** Serie semanal (days=90): cada período [inicio, fin] con los valores guardados bajo la fecha de fin. */
export function parseWeekly(raw: unknown): WeekPoint[] {
  const d = obj(raw);
  const periods = Array.isArray(d?.period) ? (d!.period as unknown[]) : [];
  const series = (k: string) => obj(d?.[k]) ?? {};
  const imp = series("impressions");
  const views = series("views");
  const leads = series("leads");
  const out: WeekPoint[] = [];
  for (const p of periods) {
    const o = obj(p);
    const from = String(o?.startPeriod ?? "");
    const to = String(o?.endPeriod ?? "");
    if (!DAY_RE.test(from) || !DAY_RE.test(to)) continue;
    out.push({ from, to, impressions: int(imp[to]) ?? 0, views: int(views[to]) ?? 0, leads: int(leads[to]) ?? 0 });
  }
  return out.sort((a, b) => a.to.localeCompare(b.to));
}

function parseChannels(raw: unknown): ContactChannels | null {
  const u = obj(raw);
  if (!u) return null;
  return {
    whatsapp: int(u.whatsapp) ?? 0,
    leadForm: int(u.leadForm) ?? 0,
    viewData: int(u.viewData) ?? 0,
    socialAds: int(u.socialAds) ?? 0,
  };
}

/** Normaliza las respuestas de los 6 endpoints. Tolera que falte cualquiera. */
export function parseZpPostingStats(raw: ZpStatsRaw): PostingStats {
  const st = obj(raw.statistic);
  const perf = obj(raw.performance);
  const total = (k: string) => int(obj(st?.[k])?.total);
  const daily = parseDaily(raw.daily);

  const trend: NonNullable<PostingStats["trend"]> = {};
  const t = (k: keyof typeof trend, block: unknown) => {
    const v = parseTrend(block);
    if (v) trend[k] = v;
  };
  t("impressions", st?.impression);
  t("visits", st?.visit);
  t("leads", st?.leads);
  t("contacts", st?.["user-stat"]);

  const channels = parseChannels(st?.userStats);
  const sum = (k: "impressions" | "views" | "leads") => (daily.length ? daily.reduce((a, p) => a + p[k], 0) : null);

  const segment = perf
    ? {
        impressions: num(perf["segment-impressions"]),
        visits: num(perf["segment-visits"]),
        leads: num(perf["segment-leads"]),
      }
    : null;

  return {
    totalImpressions: int(raw.impressions),
    totalVisits: int(raw.visits),
    totalLeads: int(obj(raw.leads)?.total ?? raw.leads),
    periodFrom: daily[0]?.day ?? null,
    periodTo: daily.at(-1)?.day ?? null,
    impressions30: total("impression") ?? int(perf?.impressions) ?? sum("impressions"),
    visits30: total("visit") ?? int(perf?.visits) ?? sum("views"),
    leads30: total("leads") ?? sum("leads"),
    contacts30: total("user-stat") ?? int(obj(st?.userStats)?.total) ?? int(perf?.leads),
    contactsByChannel: channels,
    trend: Object.keys(trend).length ? trend : null,
    segment: segment && (segment.impressions !== null || segment.visits !== null || segment.leads !== null) ? segment : null,
    daily,
    weekly: parseWeekly(raw.weekly),
  };
}

/** ¿Trajo algo útil? (si todo vino vacío, no pisamos lo que ya había). */
export function hasAnyStat(s: PostingStats): boolean {
  return (
    s.totalVisits !== null ||
    s.totalImpressions !== null ||
    s.visits30 !== null ||
    s.impressions30 !== null ||
    s.daily.length > 0
  );
}
