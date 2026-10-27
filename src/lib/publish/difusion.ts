import type { Page } from "playwright";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  ZP_QUALITY_STATES,
  issuesKey,
  parseZpPosting,
  summarize,
  zpStatus,
  type ListingIssue,
  type ListingRow,
  type ZpPosting,
  type ZpQuality,
} from "./difusion-parse";

/**
 * Panel de Difusión — guardado (worker). Los listados los recorre
 * listing-sync.ts (mismo navegador / mismas páginas de Gestión); acá se piden
 * los datos extra (calidad de ZP) y se guarda todo en jp_portal_listings.
 */

// ─── ZonaProp: calidad por aviso ─────────────────────────────────────────────

const ZP_QUALITY_CONCURRENCY = 6;

/** Pide la calidad de los avisos vivos, en tandas, dentro del panel logueado. */
export async function fetchZpQualities(page: Page, sessionId: string, postings: ZpPosting[]): Promise<Map<string, ZpQuality>> {
  const ids = postings.filter((p) => ZP_QUALITY_STATES.has(zpStatus(p))).map((p) => String(p.postingId));
  const out = new Map<string, ZpQuality>();
  for (let i = 0; i < ids.length; i += ZP_QUALITY_CONCURRENCY) {
    const batch = ids.slice(i, i + ZP_QUALITY_CONCURRENCY);
    const res = await page.evaluate(
      async ({ batch, sessionId }) =>
        Promise.all(
          batch.map(async (id) => {
            try {
              const r = await fetch(`/avisos-api/panel/api/v1/performance/getpostingquality?postingId=${id}`, {
                credentials: "include",
                headers: { accept: "application/json", sessionid: sessionId, "x-panel-portal": "ZPAR" },
              });
              return { id, status: r.status, text: r.status === 200 ? await r.text() : "" };
            } catch {
              return { id, status: 0, text: "" };
            }
          }),
        ),
      { batch, sessionId },
    );
    for (const r of res) {
      if (r.status !== 200 || !r.text) continue;
      try {
        out.set(r.id, JSON.parse(r.text) as ZpQuality);
      } catch {
        /* respuesta vacía ("") = ZP no la evalúa */
      }
    }
  }
  return out;
}

/** Totales de la cuenta que muestra el panel de ZP (duplicados, denuncias). */
export async function fetchZpDashboard(page: Page, sessionId: string): Promise<Record<string, unknown> | null> {
  const res = await page.evaluate(async (sessionId) => {
    const r = await fetch("/avisos-api/panel/api/v2/postings/dashboard/realestate", {
      credentials: "include",
      headers: { accept: "application/json", sessionid: sessionId, "x-panel-portal": "ZPAR" },
    });
    return { status: r.status, text: await r.text() };
  }, sessionId);
  if (res.status !== 200) return null;
  try {
    return JSON.parse(res.text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Avisos de ZP que van al panel: todo menos los finalizados (OFFLINE, historial viejo). */
export function zpRowsForDifusion(postings: ZpPosting[], qualities: Map<string, ZpQuality>): ListingRow[] {
  return postings.filter((p) => zpStatus(p) !== "OFFLINE").map((p) => parseZpPosting(p, qualities.get(String(p.postingId)) ?? null));
}

// ─── Guardado ────────────────────────────────────────────────────────────────

/** Código de Tokko en ArgenProp: PRO-{empresa}-{id de la propiedad en Tokko}. */
function tokkoIdFromCode(code: string | null): number | null {
  const m = code?.match(/^PRO-\d+-(\d+)$/i);
  return m ? Number(m[1]) : null;
}

/** Vincula cada aviso con nuestra propiedad: por publicación, por código o por id de Tokko. */
async function resolvePropertyIds(portal: string, rows: ListingRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pubs = await prisma.propertyPublication.findMany({
    where: { portal, externalId: { in: rows.map((r) => r.externalId) } },
    select: { externalId: true, propertyId: true },
  });
  for (const p of pubs) if (p.externalId) out.set(p.externalId, p.propertyId);

  const pending = rows.filter((r) => !out.has(r.externalId));
  const codes = [...new Set(pending.map((r) => r.code).filter((c): c is string => !!c))];
  const tokkoIds = [...new Set(pending.map((r) => tokkoIdFromCode(r.code)).filter((n): n is number => n !== null))];
  if (!codes.length && !tokkoIds.length) return out;
  const props = await prisma.property.findMany({
    where: { OR: [{ referenceCode: { in: codes } }, { externalId: { in: tokkoIds } }] },
    select: { id: true, referenceCode: true, externalId: true },
  });
  const byCode = new Map(props.filter((p) => p.referenceCode).map((p) => [p.referenceCode!.toUpperCase(), p.id]));
  const byTokko = new Map(props.filter((p) => p.externalId !== null).map((p) => [p.externalId!, p.id]));
  for (const r of pending) {
    const id = (r.code && byCode.get(r.code.toUpperCase())) || byTokko.get(tokkoIdFromCode(r.code) ?? -1);
    if (id) out.set(r.externalId, id);
  }
  return out;
}

export type DifusionSaveResult = { portal: string; seen: number; created: number; updated: number; gone: number; newIssues: number };

/**
 * Guarda los avisos de un portal. `complete` = se recorrió el listado entero:
 * sólo entonces lo que no apareció se marca como ido.
 */
export async function saveDifusion(
  portal: string,
  rows: ListingRow[],
  opts: { complete: boolean; portalSummary?: Record<string, unknown> | null },
): Promise<DifusionSaveResult> {
  const now = new Date();
  const propIds = await resolvePropertyIds(portal, rows);
  const existing = await prisma.portalListing.findMany({ where: { portal } });
  const byExt = new Map(existing.map((e) => [e.externalId, e]));
  // Primera pasada del portal: los errores que ya había no son "nuevos" (no se notifican).
  const firstLoad = existing.length === 0;

  let created = 0;
  let updated = 0;
  let newIssues = 0;
  const toCreate: Prisma.PortalListingCreateManyInput[] = [];
  for (const r of rows) {
    const propertyId = propIds.get(r.externalId) ?? null;
    const data = {
      propertyId,
      code: r.code,
      title: r.title,
      address: r.address,
      url: r.url,
      pictureUrl: r.pictureUrl,
      status: r.status,
      published: r.published,
      plan: r.plan,
      quality: r.quality,
      issues: r.issues as unknown as Prisma.InputJsonValue,
    };
    const prev = byExt.get(r.externalId);
    if (!prev) {
      const hasErr = r.issues.some((i) => i.level === "error");
      toCreate.push({ portal, externalId: r.externalId, ...data, firstSeenAt: now, lastSeenAt: now, issuesChangedAt: hasErr && !firstLoad ? now : null });
      if (hasErr && !firstLoad) newIssues++;
      continue;
    }
    const prevIssues = (prev.issues as unknown as ListingIssue[]) ?? [];
    const issuesChanged = issuesKey(prevIssues) !== issuesKey(r.issues);
    const before = new Set(prevIssues.map((i) => `${i.level}:${i.rule}`));
    const newError = r.issues.some((i) => i.level === "error" && !before.has(`${i.level}:${i.rule}`));
    if (newError) newIssues++;
    const changed =
      issuesChanged ||
      prev.gone ||
      prev.propertyId !== propertyId ||
      prev.code !== r.code ||
      prev.title !== r.title ||
      prev.address !== r.address ||
      prev.url !== r.url ||
      prev.pictureUrl !== r.pictureUrl ||
      prev.status !== r.status ||
      prev.published !== r.published ||
      prev.plan !== r.plan ||
      prev.quality !== r.quality ||
      // mismo set de reglas pero otro texto (ej. otra lista de duplicados)
      JSON.stringify(prevIssues) !== JSON.stringify(r.issues);
    if (changed) {
      await prisma.portalListing.update({
        where: { id: prev.id },
        data: { ...data, gone: false, lastSeenAt: now, ...(newError ? { issuesChangedAt: now } : {}) },
      });
      updated++;
    }
  }
  if (toCreate.length) {
    await prisma.portalListing.createMany({ data: toCreate, skipDuplicates: true });
    created = toCreate.length;
  }
  const seenIds = rows.map((r) => r.externalId);
  await prisma.portalListing.updateMany({ where: { portal, externalId: { in: seenIds } }, data: { lastSeenAt: now } });

  let gone = 0;
  if (opts.complete) {
    const res = await prisma.portalListing.updateMany({
      where: { portal, gone: false, externalId: { notIn: seenIds } },
      data: { gone: true, published: false },
    });
    gone = res.count;
  }

  const summary = { ...summarize(rows), portal: opts.portalSummary ?? null } as unknown as Prisma.InputJsonValue;
  await prisma.portalDiffusion.upsert({
    where: { portal },
    create: { portal, syncedAt: now, ok: true, error: null, summary },
    update: { syncedAt: now, ok: true, error: null, summary },
  });
  return { portal, seen: rows.length, created, updated, gone, newIssues };
}

/** Registra que la pasada falló (el panel muestra los datos anteriores con el aviso). */
export async function markDifusionError(portal: string, error: string): Promise<void> {
  await prisma.portalDiffusion
    .upsert({
      where: { portal },
      create: { portal, ok: false, error, syncedAt: new Date(0) },
      update: { ok: false, error },
    })
    .catch(() => {});
}
