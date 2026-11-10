import type { Page } from "playwright";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { markSessionInvalid, SessionExpiredError } from "@/lib/scraper/session";
import { withZonapropPanel } from "./browser-publish";
import { hasAnyStat, parseZpPostingStats, ZP_STATS_PATHS, type PostingStats, type ZpStatsRaw } from "./posting-stats-parse";

/**
 * Estadísticas de los avisos de ZonaProp para el informe al propietario
 * (worker: necesita el navegador logueado). Ver posting-stats-parse.ts.
 *
 * Cuida la huella anti-bot: sólo avisos publicados y vinculados a una
 * propiedad nuestra, una vez por día cada uno, en tandas chicas por tick.
 */

const PORTAL = "zonaprop";
/** Cada cuánto se refresca un aviso. */
const MAX_AGE_MS = Number(process.env.ZP_STATS_MAX_AGE_MS ?? 20 * 60 * 60_000);
/** Avisos por pasada (el worker pasa cada ~15 min). */
const BATCH = Number(process.env.ZP_STATS_BATCH ?? 40);
/** Si un aviso falló, no se reintenta antes de esto. */
const ERROR_RETRY_MS = 3 * 60 * 60_000;

export type PostingStatsSyncResult = { candidates: number; ok: number; failed: number; errors: string[] };

type Candidate = { externalId: string; propertyId: string | null };

/** Avisos publicados con propiedad nuestra cuyas estadísticas están viejas. */
async function staleCandidates(limit: number): Promise<Candidate[]> {
  const listings = await prisma.portalListing.findMany({
    where: { portal: PORTAL, published: true, gone: false, propertyId: { not: null } },
    select: { externalId: true, propertyId: true },
  });
  if (!listings.length) return [];
  const stats = await prisma.portalPostingStats.findMany({
    where: { portal: PORTAL, externalId: { in: listings.map((l) => l.externalId) } },
    select: { externalId: true, fetchedAt: true, error: true, updatedAt: true },
  });
  const byExt = new Map(stats.map((s) => [s.externalId, s]));
  const now = Date.now();
  return listings
    .filter((l) => {
      const s = byExt.get(l.externalId);
      if (!s) return true;
      if (s.error && now - s.updatedAt.getTime() < ERROR_RETRY_MS) return false;
      return !s.fetchedAt || now - s.fetchedAt.getTime() > MAX_AGE_MS;
    })
    .sort((a, b) => (byExt.get(a.externalId)?.fetchedAt?.getTime() ?? 0) - (byExt.get(b.externalId)?.fetchedAt?.getTime() ?? 0))
    .slice(0, limit);
}

/** Pide los 7 endpoints de un aviso en paralelo (como hace el panel al abrir "Desempeño"). */
async function fetchRaw(page: Page, sessionId: string, externalId: string): Promise<{ raw: ZpStatsRaw; statuses: number[] }> {
  const paths = ZP_STATS_PATHS(externalId);
  const entries = Object.entries(paths) as [keyof typeof paths, string][];
  const res = await page.evaluate(
    async ({ entries, sessionId }) =>
      Promise.all(
        entries.map(async ([key, url]) => {
          try {
            const r = await fetch(url, {
              credentials: "include",
              headers: { accept: "application/json", sessionid: sessionId, "x-panel-portal": "ZPAR" },
            });
            return { key, status: r.status, text: r.status === 200 ? await r.text() : "" };
          } catch {
            return { key, status: 0, text: "" };
          }
        }),
      ),
    { entries, sessionId },
  );
  const raw: ZpStatsRaw = {};
  for (const r of res) {
    if (r.status !== 200 || !r.text) continue;
    try {
      raw[r.key as keyof typeof paths] = JSON.parse(r.text);
    } catch {
      /* cuerpo no JSON: se ignora ese dato */
    }
  }
  return { raw, statuses: res.map((r) => r.status) };
}

function json(v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

function dateOnly(day: string | null): Date | null {
  return day ? new Date(`${day}T00:00:00.000Z`) : null;
}

export async function savePostingStats(externalId: string, propertyId: string | null, s: PostingStats): Promise<void> {
  const data = {
    propertyId,
    totalImpressions: s.totalImpressions,
    totalVisits: s.totalVisits,
    totalLeads: s.totalLeads,
    periodFrom: dateOnly(s.periodFrom),
    periodTo: dateOnly(s.periodTo),
    impressions30: s.impressions30,
    visits30: s.visits30,
    leads30: s.leads30,
    contacts30: s.contacts30,
    contactsByChannel: json(s.contactsByChannel),
    trend: json(s.trend),
    segment: json(s.segment),
    weekly: s.weekly.length ? (s.weekly as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    fetchedAt: new Date(),
    error: null,
  };
  await prisma.portalPostingStats.upsert({
    where: { portal_externalId: { portal: PORTAL, externalId } },
    create: { portal: PORTAL, externalId, ...data },
    update: data,
  });
  if (s.daily.length) {
    const values = s.daily.map((p) => Prisma.sql`(${PORTAL}, ${externalId}, ${p.day}::date, ${p.impressions}, ${p.views}, ${p.leads}, now())`);
    await prisma.$executeRaw`
      INSERT INTO profitos.jp_portal_posting_daily (portal, external_id, day, impressions, views, leads, updated_at)
      VALUES ${Prisma.join(values)}
      ON CONFLICT (portal, external_id, day) DO UPDATE
        SET impressions = EXCLUDED.impressions, views = EXCLUDED.views, leads = EXCLUDED.leads, updated_at = now()`;
  }
}

async function saveError(externalId: string, propertyId: string | null, error: string): Promise<void> {
  await prisma.portalPostingStats.upsert({
    where: { portal_externalId: { portal: PORTAL, externalId } },
    create: { portal: PORTAL, externalId, propertyId, error },
    update: { propertyId, error },
  });
}

async function runBatch(list: Candidate[]): Promise<PostingStatsSyncResult> {
  const result: PostingStatsSyncResult = { candidates: list.length, ok: 0, failed: 0, errors: [] };
  if (!list.length) return result;
  await withZonapropPanel(async (page, sessionId) => {
    for (const c of list) {
      const { raw, statuses } = await fetchRaw(page, sessionId, c.externalId);
      if (statuses.includes(401)) {
        await markSessionInvalid(PORTAL);
        throw new SessionExpiredError(PORTAL);
      }
      const stats = parseZpPostingStats(raw);
      if (hasAnyStat(stats)) {
        await savePostingStats(c.externalId, c.propertyId, stats);
        result.ok++;
      } else {
        const msg = `sin datos (HTTP ${[...new Set(statuses)].join("/")})`;
        await saveError(c.externalId, c.propertyId, msg);
        result.failed++;
        result.errors.push(`${c.externalId}: ${msg}`);
      }
      await page.waitForTimeout(300 + Math.floor(Math.random() * 500));
    }
  });
  return result;
}

/** Pasada del worker: refresca una tanda de avisos vencidos. No abre el navegador si no hay nada que hacer. */
export async function syncZonapropPostingStats(limit = BATCH): Promise<PostingStatsSyncResult> {
  return runBatch(await staleCandidates(limit));
}

/** Avisos de ZonaProp de una propiedad (vínculo de publicación o del panel de Difusión). */
export async function zonapropPostingsOf(propertyId: string): Promise<Candidate[]> {
  const [pub, listings] = await Promise.all([
    prisma.propertyPublication.findUnique({
      where: { propertyId_portal: { propertyId, portal: PORTAL } },
      select: { externalId: true },
    }),
    prisma.portalListing.findMany({
      where: { portal: PORTAL, propertyId, gone: false },
      select: { externalId: true, published: true },
      orderBy: { published: "desc" },
    }),
  ]);
  const ids = [pub?.externalId, ...listings.map((l) => l.externalId)].filter((x): x is string => !!x);
  return [...new Set(ids)].slice(0, 3).map((externalId) => ({ externalId, propertyId }));
}

/** Refresca avisos puntuales (script de operación). */
export async function refreshPostings(externalIds: string[]): Promise<PostingStatsSyncResult> {
  const listings = await prisma.portalListing.findMany({
    where: { portal: PORTAL, externalId: { in: externalIds } },
    select: { externalId: true, propertyId: true },
  });
  const prop = new Map(listings.map((l) => [l.externalId, l.propertyId]));
  return runBatch(externalIds.map((externalId) => ({ externalId, propertyId: prop.get(externalId) ?? null })));
}

/** "Actualizar ahora" desde el informe: refresca los avisos de una propiedad. */
export async function refreshPropertyPostingStats(propertyId: string): Promise<PostingStatsSyncResult> {
  return runBatch(await zonapropPostingsOf(propertyId));
}
