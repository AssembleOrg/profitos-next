import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma/client";

const ZONE = "America/Argentina/Buenos_Aires";
const CONTACT_TYPES = "('whatsapp_click','phone_click','email_click','form_submit','development_click')";
const EVENTS = "profitos.jp_web_events";
const VISITORS = "profitos.jp_web_visitors";

export type InsightFilters = {
  desde?: string;
  hasta?: string;
  dias?: string;
  dispositivo?: string;
  canal?: string;
  persona?: string;
  op?: string;
  tipo?: string;
  zona?: string;
};

export type Range = { from: Date; to: Date; label: string; prevFrom: Date; prevTo: Date; days: number };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Días calendario de Argentina. Hasta exclusivo. El período anterior tiene la misma duración. */
export function resolveRange(filters: InsightFilters, now = DateTime.now().setZone(ZONE)): Range {
  let start: DateTime;
  let end: DateTime;
  if (filters.desde && DAY.test(filters.desde)) {
    start = DateTime.fromISO(filters.desde, { zone: ZONE }).startOf("day");
    end = filters.hasta && DAY.test(filters.hasta) ? DateTime.fromISO(filters.hasta, { zone: ZONE }).plus({ days: 1 }).startOf("day") : now.plus({ days: 1 }).startOf("day");
  } else {
    const days = Math.min(Math.max(Number(filters.dias) || 30, 1), 730);
    end = now.plus({ days: 1 }).startOf("day");
    start = end.minus({ days });
  }
  if (end <= start) end = start.plus({ days: 1 });
  const days = Math.round(end.diff(start, "days").days);
  return {
    from: start.toUTC().toJSDate(),
    to: end.toUTC().toJSDate(),
    label: `${start.toFormat("dd/MM/yy")} al ${end.minus({ days: 1 }).toFormat("dd/MM/yy")}`,
    prevFrom: start.minus({ days }).toUTC().toJSDate(),
    prevTo: start.toUTC().toJSDate(),
    days,
  };
}

/** Condiciones comunes: nunca bots ni gente del equipo. Todos los valores van como parámetros. */
function whereFor(filters: InsightFilters, from: Date, to: Date) {
  const params: unknown[] = [from, to];
  const clauses = [`e.created_at >= $1`, `e.created_at < $2`, `NOT e.is_bot`, `COALESCE(v.is_internal, false) = false`];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.dispositivo) add("e.device = ?", filters.dispositivo);
  if (filters.canal) add("e.channel = ?", filters.canal);
  if (filters.op) add("e.operation = ?", filters.op);
  if (filters.tipo) add("e.property_type = ?", filters.tipo);
  if (filters.zona) add("e.zone = ?", filters.zona);
  if (filters.persona === "registrados") clauses.push("e.visitor_id IS NOT NULL");
  if (filters.persona === "anonimos") clauses.push("e.visitor_id IS NULL");
  return { where: clauses.join(" AND "), params };
}

const FROM = `FROM ${EVENTS} e LEFT JOIN ${VISITORS} v ON v.id = e.visitor_id`;
const PERSON = "COALESCE(e.visitor_id, e.anon_id)";
const PROPERTY_VIEW = "e.type = 'page_view' AND e.property_key IS NOT NULL";

type Num = number | bigint | null;
const n = (value: Num | string | undefined): number => Number(value ?? 0);

async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}

export type Kpis = {
  visitors: number;
  sessions: number;
  registrations: number;
  propertyViews: number;
  searches: number;
  contacts: number;
  contactPeople: number;
  conversion: number;
  avgPropertySeconds: number;
  favorites: number;
};

async function kpis(filters: InsightFilters, from: Date, to: Date): Promise<Kpis> {
  const { where, params } = whereFor(filters, from, to);
  const [row] = await query<Record<string, Num>>(
    `SELECT COUNT(DISTINCT ${PERSON}) visitors,
       COUNT(DISTINCT e.session_id) sessions,
       COUNT(*) FILTER (WHERE ${PROPERTY_VIEW}) property_views,
       COUNT(*) FILTER (WHERE e.type = 'search') searches,
       COUNT(*) FILTER (WHERE e.type IN ${CONTACT_TYPES}) contacts,
       COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.type IN ${CONTACT_TYPES}) contact_people,
       COUNT(*) FILTER (WHERE e.type = 'favorite_add') favorites,
       COALESCE(AVG(e.duration_ms) FILTER (WHERE ${PROPERTY_VIEW} AND e.duration_ms > 0), 0)::float avg_ms,
       COUNT(*) FILTER (WHERE e.type = 'login' AND e.label = 'primer ingreso') registrations
     ${FROM} WHERE ${where}`,
    params,
  );
  const visitors = n(row.visitors);
  const contactPeople = n(row.contact_people);
  return {
    visitors,
    sessions: n(row.sessions),
    registrations: n(row.registrations),
    propertyViews: n(row.property_views),
    searches: n(row.searches),
    contacts: n(row.contacts),
    contactPeople,
    conversion: visitors ? contactPeople / visitors : 0,
    avgPropertySeconds: Math.round(n(row.avg_ms) / 1000),
    favorites: n(row.favorites),
  };
}

export type TrendPoint = { day: string; visitors: number; sessions: number; propertyViews: number; searches: number; contacts: number };

async function trend(filters: InsightFilters, from: Date, to: Date): Promise<TrendPoint[]> {
  const { where, params } = whereFor(filters, from, to);
  const rows = await query<Record<string, Num | string>>(
    `SELECT to_char((e.created_at AT TIME ZONE 'UTC') AT TIME ZONE '${ZONE}', 'YYYY-MM-DD') AS day,
       COUNT(DISTINCT ${PERSON}) visitors,
       COUNT(DISTINCT e.session_id) sessions,
       COUNT(*) FILTER (WHERE ${PROPERTY_VIEW}) property_views,
       COUNT(*) FILTER (WHERE e.type = 'search') searches,
       COUNT(*) FILTER (WHERE e.type IN ${CONTACT_TYPES}) contacts
     ${FROM} WHERE ${where} GROUP BY 1 ORDER BY 1`,
    params,
  );
  const byDay = new Map(rows.map((row) => [row.day as string, row]));
  const points: TrendPoint[] = [];
  let cursor = DateTime.fromJSDate(from, { zone: ZONE }).startOf("day");
  const end = DateTime.fromJSDate(to, { zone: ZONE });
  while (cursor < end) {
    const day = cursor.toFormat("yyyy-MM-dd");
    const row = byDay.get(day);
    points.push({ day, visitors: n(row?.visitors as Num), sessions: n(row?.sessions as Num), propertyViews: n(row?.property_views as Num), searches: n(row?.searches as Num), contacts: n(row?.contacts as Num) });
    cursor = cursor.plus({ days: 1 });
  }
  return points;
}

export type Slice = { name: string; people: number };

async function slice(column: string, filters: InsightFilters, range: Range, extra = ""): Promise<Slice[]> {
  const { where, params } = whereFor(filters, range.from, range.to);
  const rows = await query<{ name: string; people: Num }>(
    `SELECT ${column} AS name, COUNT(DISTINCT ${PERSON}) people ${FROM} WHERE ${where} AND ${column} IS NOT NULL ${extra} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    params,
  );
  return rows.map((row) => ({ name: row.name, people: n(row.people) }));
}

export type Funnel = { label: string; people: number }[];

async function funnel(filters: InsightFilters, range: Range): Promise<Funnel> {
  const { where, params } = whereFor(filters, range.from, range.to);
  const [row] = await query<Record<string, Num>>(
    `SELECT COUNT(DISTINCT ${PERSON}) visited,
       COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.type = 'search') searched,
       COUNT(DISTINCT ${PERSON}) FILTER (WHERE ${PROPERTY_VIEW}) viewed,
       COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.type = 'favorite_add' OR e.type = 'photo_open') engaged,
       COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.type IN ${CONTACT_TYPES}) contacted
     ${FROM} WHERE ${where}`,
    params,
  );
  return [
    { label: "Entraron", people: n(row.visited) },
    { label: "Buscaron", people: n(row.searched) },
    { label: "Vieron una ficha", people: n(row.viewed) },
    { label: "Abrieron fotos o guardaron", people: n(row.engaged) },
    { label: "Consultaron", people: n(row.contacted) },
  ];
}

export async function getOverview(filters: InsightFilters, range: Range) {
  const [current, previous, points, previousPoints, steps, devices, channels, browsers, operations, types, zones] = await Promise.all([
    kpis(filters, range.from, range.to),
    kpis(filters, range.prevFrom, range.prevTo),
    trend(filters, range.from, range.to),
    trend(filters, range.prevFrom, range.prevTo),
    funnel(filters, range),
    slice("e.device", filters, range),
    slice("e.channel", filters, range),
    slice("e.browser", filters, range),
    slice("e.operation", filters, range),
    slice("e.property_type", filters, range),
    slice("e.zone", filters, range),
  ]);
  return { current, previous, points, previousPoints, steps, devices, channels, browsers, operations, types, zones };
}

export type PropertyRow = {
  key: string;
  address: string;
  type: string | null;
  zone: string | null;
  operation: string | null;
  views: number;
  people: number;
  avgSeconds: number;
  totalMinutes: number;
  photos: number;
  favorites: number;
  contacts: number;
  conversion: number;
};

export async function getProperties(filters: InsightFilters, range: Range): Promise<PropertyRow[]> {
  const { where, params } = whereFor(filters, range.from, range.to);
  const rows = await query<Record<string, Num | string | null>>(
    `SELECT e.property_key AS key, MAX(e.address) address, MAX(e.property_type) type, MAX(e.zone) zone, MAX(e.operation) operation,
       COUNT(*) FILTER (WHERE e.type = 'page_view') views,
       COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.type = 'page_view') people,
       COALESCE(AVG(e.duration_ms) FILTER (WHERE e.type = 'page_view' AND e.duration_ms > 0), 0)::float avg_ms,
       COALESCE(SUM(e.duration_ms) FILTER (WHERE e.type = 'page_view'), 0)::float total_ms,
       COUNT(*) FILTER (WHERE e.type = 'photo_open') photos,
       COUNT(*) FILTER (WHERE e.type = 'favorite_add') favorites,
       COUNT(*) FILTER (WHERE e.type IN ${CONTACT_TYPES}) contacts,
       COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.type IN ${CONTACT_TYPES}) contact_people
     ${FROM} WHERE ${where} AND e.property_key IS NOT NULL GROUP BY e.property_key ORDER BY views DESC, contacts DESC LIMIT 500`,
    params,
  );
  return rows.map((row) => {
    const people = n(row.people as Num);
    return {
      key: row.key as string,
      address: (row.address as string) ?? (row.key as string),
      type: row.type as string | null,
      zone: row.zone as string | null,
      operation: row.operation as string | null,
      views: n(row.views as Num),
      people,
      avgSeconds: Math.round(n(row.avg_ms as Num) / 1000),
      totalMinutes: Math.round(n(row.total_ms as Num) / 60000),
      photos: n(row.photos as Num),
      favorites: n(row.favorites as Num),
      contacts: n(row.contacts as Num),
      conversion: people ? n(row.contact_people as Num) / people : 0,
    };
  });
}

export type PropertyViewer = { id: string; registered: boolean; name: string | null; email: string | null; phone: string | null; visits: number; seconds: number; photos: number; favorited: boolean; contacted: boolean; lastSeen: string };

/** Quién miró una propiedad. Respeta los mismos filtros que el resto del panel. */
export async function getPropertyViewers(key: string, filters: InsightFilters, range: Range) {
  const { where, params } = whereFor(filters, range.from, range.to);
  params.push(key);
  const rows = await query<Record<string, Num | string | boolean | Date | null>>(
    `SELECT ${PERSON} AS id, e.visitor_id IS NOT NULL AS registered, MAX(v.name) AS name, MAX(v.email) AS email, MAX(v.phone) AS phone,
       MAX(e.address) AS address, MAX(e.property_type) AS type, MAX(e.zone) AS zone, MAX(e.operation) AS operation,
       COUNT(*) FILTER (WHERE e.type = 'page_view') AS visits,
       COALESCE(SUM(e.duration_ms) FILTER (WHERE e.type = 'page_view'), 0)::float AS ms,
       COUNT(*) FILTER (WHERE e.type = 'photo_open') AS photos,
       BOOL_OR(e.type = 'favorite_add') AS favorited,
       BOOL_OR(e.type IN ${CONTACT_TYPES}) AS contacted,
       MAX(e.created_at) AS last_seen
     ${FROM} WHERE ${where} AND e.property_key = $${params.length} GROUP BY 1, 2 ORDER BY ms DESC LIMIT 500`,
    params,
  );
  const first = rows[0];
  return {
    address: (first?.address as string) ?? key,
    subtitle: [first?.type, first?.zone, first?.operation].filter(Boolean).join(" · "),
    viewers: rows.map((row): PropertyViewer => ({
      id: row.id as string,
      registered: Boolean(row.registered),
      name: row.name as string | null,
      email: row.email as string | null,
      phone: row.phone as string | null,
      visits: n(row.visits as Num),
      seconds: Math.round(n(row.ms as Num) / 1000),
      photos: n(row.photos as Num),
      favorited: Boolean(row.favorited),
      contacted: Boolean(row.contacted),
      lastSeen: (row.last_seen as Date).toISOString(),
    })),
  };
}

export type SearchRow = { signature: string; filters: Record<string, string>; query: string | null; count: number; people: number; avgResults: number; zero: boolean };

function describeSearch(filters: Record<string, string> | null, text: string | null): string {
  const parts: string[] = [];
  const f = filters ?? {};
  if (f.op) parts.push(f.op === "venta" ? "Venta" : "Alquiler");
  if (f.tipo) parts.push(f.tipo);
  if (f.zona) parts.push(f.zona);
  if (f.amb) parts.push(f.amb === "5" ? "5+ amb." : `${f.amb} amb.`);
  if (f.dorm) parts.push(`${f.dorm}+ dorm.`);
  if (f.min || f.max) parts.push(`${f.moneda === "USD" ? "USD " : f.moneda === "ARS" ? "$ " : ""}${f.min ?? "0"} a ${f.max ?? "sin tope"}`);
  if (f.sup) parts.push(`desde ${f.sup} m²`);
  if (text) parts.push(`“${text}”`);
  return parts.join(" · ") || "Sin filtros";
}

export async function getSearches(filters: InsightFilters, range: Range) {
  const { where, params } = whereFor(filters, range.from, range.to);
  const rows = await query<{ filters: Record<string, string> | null; query: string | null; count: Num; people: Num; avg_results: Num; zero_count: Num }>(
    `SELECT e.filters - 'orden' AS filters, e.query, COUNT(*) AS count, COUNT(DISTINCT ${PERSON}) AS people,
       COALESCE(AVG(e.results_count), 0)::float avg_results,
       COUNT(*) FILTER (WHERE e.results_count = 0) zero_count
     ${FROM} WHERE ${where} AND e.type = 'search' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 300`,
    params,
  );
  const searches: SearchRow[] = rows.map((row) => ({
    signature: describeSearch(row.filters, row.query),
    filters: row.filters ?? {},
    query: row.query,
    count: n(row.count),
    people: n(row.people),
    avgResults: Math.round(n(row.avg_results)),
    zero: n(row.count) > 0 && n(row.zero_count) === n(row.count),
  }));
  const demand = async (key: string, formatter: (value: string) => string = (value) => value): Promise<Slice[]> => {
    const data = await query<{ name: string; people: Num }>(
      `SELECT e.filters->>'${key}' AS name, COUNT(DISTINCT ${PERSON}) people ${FROM} WHERE ${where} AND e.type = 'search' AND e.filters ? '${key}' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      params,
    );
    return data.map((row) => ({ name: formatter(row.name), people: n(row.people) }));
  };
  const [zones, types, rooms] = await Promise.all([demand("zona"), demand("tipo"), demand("amb", (value) => (value === "5" ? "5 o más" : `${value} amb.`))]);
  return { searches, zeros: searches.filter((row) => row.zero), zones, types, rooms };
}

export type PersonRow = {
  id: string;
  registered: boolean;
  name: string | null;
  email: string | null;
  phone: string | null;
  marketing: boolean;
  firstSeen: string;
  lastSeen: string;
  sessions: number;
  views: number;
  minutes: number;
  searches: number;
  favorites: number;
  contacts: number;
  score: number;
  level: "Alto" | "Medio" | "Bajo";
  device: string | null;
};

/** Interés: cada acción pesa según cuánto dice de una intención real. Visible en el panel. */
export function interestScore(row: { sessions: number; views: number; minutes: number; favorites: number; contacts: number }) {
  const score = row.views + Math.min(row.minutes, 30) + Math.max(row.sessions - 1, 0) * 2 + row.favorites * 5 + row.contacts * 15;
  return { score, level: (score >= 30 ? "Alto" : score >= 10 ? "Medio" : "Bajo") as PersonRow["level"] };
}

export async function getPeople(filters: InsightFilters, range: Range): Promise<PersonRow[]> {
  const { where, params } = whereFor(filters, range.from, range.to);
  const rows = await query<Record<string, Num | string | boolean | Date | null>>(
    `SELECT ${PERSON} AS id, e.visitor_id IS NOT NULL AS registered, MAX(v.name) AS name, MAX(v.email) AS email, MAX(v.phone) AS phone,
       COALESCE(BOOL_OR(v.marketing_consent), false) AS marketing,
       MIN(e.created_at) first_seen, MAX(e.created_at) last_seen, MAX(e.device) device,
       COUNT(DISTINCT e.session_id) sessions,
       COUNT(*) FILTER (WHERE ${PROPERTY_VIEW}) views,
       COALESCE(SUM(e.duration_ms) FILTER (WHERE ${PROPERTY_VIEW}), 0)::float property_ms,
       COUNT(*) FILTER (WHERE e.type = 'search') searches,
       COUNT(*) FILTER (WHERE e.type = 'favorite_add') favorites,
       COUNT(*) FILTER (WHERE e.type IN ${CONTACT_TYPES}) contacts
     ${FROM} WHERE ${where} GROUP BY 1, 2 ORDER BY MAX(e.created_at) DESC LIMIT 1000`,
    params,
  );
  return rows
    .map((row) => {
      const base = {
        sessions: n(row.sessions as Num),
        views: n(row.views as Num),
        minutes: Math.round(n(row.property_ms as Num) / 60000),
        searches: n(row.searches as Num),
        favorites: n(row.favorites as Num),
        contacts: n(row.contacts as Num),
      };
      return {
        id: row.id as string,
        registered: Boolean(row.registered),
        name: row.name as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
        marketing: Boolean(row.marketing),
        firstSeen: (row.first_seen as Date).toISOString(),
        lastSeen: (row.last_seen as Date).toISOString(),
        device: row.device as string | null,
        ...base,
        ...interestScore(base),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export type TimelineEvent = { id: string; type: string; at: string; address: string | null; propertyKey: string | null; durationSeconds: number; scrollDepth: number | null; label: string | null; query: string | null; filters: Record<string, string> | null; results: number | null; path: string | null; device: string | null; channel: string | null };

export async function getPerson(id: string) {
  const visitor = await prisma.webVisitor.findUnique({ where: { id } });
  const events = await prisma.webEvent.findMany({
    where: visitor ? { visitorId: id } : { anonId: id, visitorId: null },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  if (!visitor && events.length === 0) return null;
  const timeline: TimelineEvent[] = events.map((event) => ({
    id: event.id,
    type: event.type,
    at: event.createdAt.toISOString(),
    address: event.address,
    propertyKey: event.propertyKey,
    durationSeconds: Math.round((event.durationMs ?? 0) / 1000),
    scrollDepth: event.scrollDepth,
    label: event.label,
    query: event.query,
    filters: event.filters as Record<string, string> | null,
    results: event.resultsCount,
    path: event.path,
    device: event.device,
    channel: event.channel,
  }));
  const views = new Map<string, { address: string; seconds: number; visits: number }>();
  for (const event of timeline) {
    if (event.type !== "page_view" || !event.propertyKey) continue;
    const current = views.get(event.propertyKey) ?? { address: event.address ?? event.propertyKey, seconds: 0, visits: 0 };
    current.seconds += event.durationSeconds;
    current.visits += 1;
    views.set(event.propertyKey, current);
  }
  return {
    visitor: visitor && {
      name: visitor.name,
      email: visitor.email,
      phone: visitor.phone,
      picture: visitor.pictureUrl,
      marketing: visitor.marketingConsent,
      logins: visitor.loginCount,
      firstLogin: visitor.firstLoginAt.toISOString(),
      favorites: Array.isArray(visitor.favorites) ? (visitor.favorites as string[]).length : 0,
    },
    timeline,
    topProperties: [...views.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.seconds - a.seconds).slice(0, 8),
  };
}

export async function getQuality(range: Range) {
  const params = [range.from, range.to];
  const [row] = await query<Record<string, Num | Date | null>>(
    `SELECT COUNT(*) total,
       COUNT(*) FILTER (WHERE e.is_bot) bots,
       COUNT(*) FILTER (WHERE COALESCE(v.is_internal, false)) internal,
       COUNT(*) FILTER (WHERE e.visitor_id IS NOT NULL AND NOT e.is_bot) identified,
       COUNT(*) FILTER (WHERE e.type = 'page_view' AND COALESCE(e.duration_ms, 0) = 0 AND NOT e.is_bot) no_time,
       COUNT(*) FILTER (WHERE e.type = 'page_view' AND NOT e.is_bot) page_views,
       COUNT(*) FILTER (WHERE e.channel IS NULL) no_channel,
       MAX(e.created_at) last_event, MIN(e.created_at) first_event
     ${FROM} WHERE e.created_at >= $1 AND e.created_at < $2`,
    params,
  );
  const [people] = await query<Record<string, Num>>(
    `SELECT COUNT(*) total, COUNT(*) FILTER (WHERE phone IS NOT NULL) with_phone, COUNT(*) FILTER (WHERE marketing_consent) marketing,
       COUNT(*) FILTER (WHERE is_internal) internal FROM ${VISITORS}`,
    [],
  );
  const byType = await query<{ type: string; count: Num }>(
    `SELECT e.type, COUNT(*) AS count ${FROM} WHERE e.created_at >= $1 AND e.created_at < $2 AND NOT e.is_bot AND COALESCE(v.is_internal, false) = false GROUP BY 1 ORDER BY 2 DESC`,
    params,
  );
  return {
    total: n(row.total as Num),
    bots: n(row.bots as Num),
    internal: n(row.internal as Num),
    identified: n(row.identified as Num),
    pageViews: n(row.page_views as Num),
    noTime: n(row.no_time as Num),
    lastEvent: row.last_event ? (row.last_event as Date).toISOString() : null,
    firstEvent: row.first_event ? (row.first_event as Date).toISOString() : null,
    registered: n(people.total),
    withPhone: n(people.with_phone),
    marketing: n(people.marketing),
    byType: byType.map((item) => ({ type: item.type, count: n(item.count) })),
  };
}

export async function getFilterOptions() {
  const rows = await query<{ channel: string | null; device: string | null; operation: string | null; property_type: string | null; zone: string | null }>(
    `SELECT DISTINCT channel, device, operation, property_type, zone FROM ${EVENTS} WHERE created_at > now() - interval '365 days' LIMIT 5000`,
    [],
  );
  const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "es"));
  return {
    channels: unique(rows.map((row) => row.channel)),
    devices: unique(rows.map((row) => row.device)),
    operations: unique(rows.map((row) => row.operation)),
    types: unique(rows.map((row) => row.property_type)),
    zones: unique(rows.map((row) => row.zone)),
  };
}
