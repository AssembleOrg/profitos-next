import { prisma } from "@/lib/prisma/client";
import { now } from "@/lib/datetime";
import type { ContactChannels, DailyPoint, Trend, WeekPoint } from "@/lib/zonaprop/posting-stats-parse";
import { monthSummary, pickPosting, type MonthSummary } from "./owner-stats-calc";

/**
 * Datos automáticos del informe al propietario:
 *  - ZonaProp: lo que el portal informa del aviso (worker → jp_portal_posting_stats / _daily).
 *  - Consultas que entraron a Profitos por cada portal (central de mensajes).
 *  - Visitas presenciales agendadas en la agenda.
 */

export type ZonapropReport = {
  externalId: string;
  fetchedAt: string | null;
  error: string | null;
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
  thisMonth: MonthSummary;
  lastMonth: MonthSummary;
};

export type InquiryCount = { key: string; label: string; total: number; last30: number };

export type OwnerReportStats = {
  zonaprop: ZonapropReport | null;
  inquiries: { since: string | null; total: number; last30: number; byPortal: InquiryCount[] };
  inPersonVisits: { total: number; thisMonth: number };
};

const PORTAL_LABEL: Record<string, string> = {
  zonaprop: "ZonaProp",
  argenprop: "ArgenProp",
  mercadolibre: "MercadoLibre",
};

async function zonapropReport(propertyId: string): Promise<ZonapropReport | null> {
  const [rows, pub, listings] = await Promise.all([
    prisma.portalPostingStats.findMany({ where: { portal: "zonaprop", propertyId } }),
    prisma.propertyPublication.findUnique({
      where: { propertyId_portal: { propertyId, portal: "zonaprop" } },
      select: { externalId: true },
    }),
    prisma.portalListing.findMany({
      where: { portal: "zonaprop", propertyId, published: true, gone: false },
      select: { externalId: true },
    }),
  ]);
  const row = pickPosting(rows, pub?.externalId ?? null, new Set(listings.map((l) => l.externalId)));
  if (!row) return null;

  const today = now();
  const lastMonthStart = today.startOf("month").minus({ months: 1 });
  const since = new Date(`${lastMonthStart.toISODate()}T00:00:00.000Z`);
  const daily = await prisma.portalPostingDaily.findMany({
    where: { portal: "zonaprop", externalId: row.externalId, day: { gte: since } },
    orderBy: { day: "asc" },
  });
  const points: DailyPoint[] = daily.map((d) => ({
    day: d.day.toISOString().slice(0, 10),
    impressions: d.impressions,
    views: d.views,
    leads: d.leads,
  }));
  const todayIso = today.toISODate()!;
  const fromIso = today.minus({ days: 29 }).toISODate()!;

  return {
    externalId: row.externalId,
    fetchedAt: row.fetchedAt?.toISOString() ?? null,
    error: row.error,
    totalImpressions: row.totalImpressions,
    totalVisits: row.totalVisits,
    totalLeads: row.totalLeads,
    periodFrom: row.periodFrom?.toISOString().slice(0, 10) ?? null,
    periodTo: row.periodTo?.toISOString().slice(0, 10) ?? null,
    impressions30: row.impressions30,
    visits30: row.visits30,
    leads30: row.leads30,
    contacts30: row.contacts30,
    contactsByChannel: (row.contactsByChannel as ContactChannels | null) ?? null,
    trend: (row.trend as ZonapropReport["trend"]) ?? null,
    segment: (row.segment as ZonapropReport["segment"]) ?? null,
    daily: points.filter((p) => p.day >= fromIso && p.day <= todayIso),
    weekly: Array.isArray(row.weekly) ? (row.weekly as unknown as WeekPoint[]) : [],
    thisMonth: monthSummary(points, today.toISODate()!.slice(0, 7), todayIso),
    lastMonth: monthSummary(points, lastMonthStart.toISODate()!.slice(0, 7), todayIso),
  };
}

async function inquiries(propertyId: string, referenceCode: string | null): Promise<OwnerReportStats["inquiries"]> {
  const cutoff = now().minus({ days: 30 }).toJSDate();
  const [leads, questions, first] = await Promise.all([
    referenceCode
      ? prisma.scrapedLead.findMany({
          where: { propertyRef: referenceCode },
          select: { portal: true, messageAt: true, scrapedAt: true },
        })
      : Promise.resolve([]),
    prisma.portalQuestion.findMany({
      where: { propertyId },
      select: { askedAt: true, createdAt: true },
    }),
    prisma.scrapedLead.aggregate({ _min: { scrapedAt: true } }),
  ]);
  const map = new Map<string, InquiryCount>();
  const add = (key: string, label: string, at: Date) => {
    const c = map.get(key) ?? { key, label, total: 0, last30: 0 };
    c.total++;
    if (at >= cutoff) c.last30++;
    map.set(key, c);
  };
  for (const l of leads) add(l.portal, PORTAL_LABEL[l.portal] ?? l.portal, l.messageAt ?? l.scrapedAt);
  for (const q of questions) add("mercadolibre-preguntas", "MercadoLibre (preguntas)", q.askedAt ?? q.createdAt);
  const byPortal = [...map.values()].sort((a, b) => b.total - a.total);
  return {
    since: first._min.scrapedAt?.toISOString() ?? null,
    total: byPortal.reduce((a, c) => a + c.total, 0),
    last30: byPortal.reduce((a, c) => a + c.last30, 0),
    byPortal,
  };
}

async function inPersonVisits(propertyId: string): Promise<OwnerReportStats["inPersonVisits"]> {
  const monthStart = new Date(`${now().startOf("month").toISODate()}T00:00:00.000Z`);
  const [total, thisMonth] = await Promise.all([
    prisma.visit.count({ where: { propertyId, type: "visita" } }),
    prisma.visit.count({ where: { propertyId, type: "visita", date: { gte: monthStart } } }),
  ]);
  return { total, thisMonth };
}

export async function getOwnerReportStats(propertyId: string, referenceCode: string | null): Promise<OwnerReportStats> {
  const [zonaprop, inq, visits] = await Promise.all([
    zonapropReport(propertyId),
    inquiries(propertyId, referenceCode),
    inPersonVisits(propertyId),
  ]);
  return { zonaprop, inquiries: inq, inPersonVisits: visits };
}
