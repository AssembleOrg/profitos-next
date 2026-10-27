import { prisma } from "@/lib/prisma/client";
import { HIDDEN_PROPERTY_SOURCES } from "@/lib/domain/types";
import { summarize, type ListingIssue, type PortalSummary } from "./difusion-parse";

/**
 * Datos del panel de Difusión para la web. ZonaProp y ArgenProp salen de
 * jp_portal_listings (lo llena el worker); MercadoLibre de las publicaciones
 * propias (jp_property_publications), que ya sincroniza la API oficial.
 */

export type DifusionListing = {
  id: string;
  portal: string;
  externalId: string;
  code: string | null;
  title: string | null;
  address: string | null;
  url: string | null;
  pictureUrl: string | null;
  status: string;
  published: boolean;
  plan: string | null;
  quality: number | null;
  issues: ListingIssue[];
  issuesChangedAt: string | null;
  property: { id: string; address: string } | null;
};

export type DifusionPortal = {
  portal: string;
  syncedAt: string | null;
  ok: boolean;
  error: string | null;
  summary: PortalSummary;
  /** Totales que informa el portal (ZP: duplicados, denuncias). */
  portalTotals: Record<string, unknown> | null;
  /** Propiedades publicadas en otro portal pero no en este. */
  sinAviso: number;
};

export type DifusionUnlisted = { id: string; address: string; referenceCode: string | null; missing: string[] };

const ML_PLAN: Record<string, string> = { gold_premium: "premium", gold_pro: "premium", gold_special: "clasica", gold: "clasica", silver: "clasica", bronze: "clasica", free: "gratuita" };

function mlIssues(p: { status: string; lastError: string | null; externalChangeDetail: string | null }): ListingIssue[] {
  if (p.status === "error") return [{ rule: "publish_error", level: "error", message: p.lastError || "Falló la publicación." }];
  if (p.status === "draft" || p.status === "publishing") {
    return [{ rule: "not_published", level: "error", message: p.lastError || "Quedó sin publicar: no llegó a salir en MercadoLibre." }];
  }
  if (p.status === "not_yet_active" || p.status === "under_review") {
    return [{ rule: "under_review", level: "warn", message: "MercadoLibre todavía lo está revisando." }];
  }
  if ((p.status === "paused" || p.status === "closed") && p.externalChangeDetail) {
    return [{ rule: "external_change", level: "error", message: p.externalChangeDetail }];
  }
  return [];
}

export async function getDifusionData(): Promise<{ portals: DifusionPortal[]; listings: DifusionListing[]; unlisted: DifusionUnlisted[] }> {
  const [rows, states, mlPubs, activeProps] = await Promise.all([
    prisma.portalListing.findMany({ where: { gone: false }, orderBy: [{ issuesChangedAt: { sort: "desc", nulls: "last" } }, { lastSeenAt: "desc" }] }),
    prisma.portalDiffusion.findMany(),
    prisma.propertyPublication.findMany({
      where: { portal: "mercadolibre", OR: [{ status: { notIn: ["closed"] } }, { externalChangeAt: { not: null } }] },
      select: {
        id: true,
        externalId: true,
        status: true,
        permalink: true,
        listingTypeId: true,
        lastError: true,
        externalChangeAt: true,
        externalChangeDetail: true,
        updatedAt: true,
        property: { select: { id: true, address: true, referenceCode: true, publicationTitle: true, coverImageUrl: true, status: true } },
      },
    }),
    prisma.property.findMany({
      where: { status: "activa", source: { notIn: HIDDEN_PROPERTY_SOURCES } },
      select: { id: true, address: true, referenceCode: true },
      orderBy: { address: "asc" },
    }),
  ]);

  const propIds = [...new Set(rows.map((r) => r.propertyId).filter((x): x is string => !!x))];
  const props = propIds.length ? await prisma.property.findMany({ where: { id: { in: propIds } }, select: { id: true, address: true } }) : [];
  const propMap = new Map(props.map((p) => [p.id, p]));

  const listings: DifusionListing[] = rows.map((r) => ({
    id: r.id,
    portal: r.portal,
    externalId: r.externalId,
    code: r.code,
    title: r.title,
    address: r.address,
    url: r.url,
    pictureUrl: r.pictureUrl,
    status: r.status,
    published: r.published,
    plan: r.plan,
    quality: r.quality,
    issues: (r.issues as unknown as ListingIssue[]) ?? [],
    issuesChangedAt: r.issuesChangedAt?.toISOString() ?? null,
    property: r.propertyId ? (propMap.get(r.propertyId) ?? null) : null,
  }));

  // MercadoLibre: una baja externa vieja (más de 30 días) ya no es noticia.
  const mlCut = Date.now() - 30 * 24 * 60 * 60_000;
  for (const p of mlPubs) {
    if (p.status === "closed" && (!p.externalChangeAt || p.externalChangeAt.getTime() < mlCut)) continue;
    // Si la propiedad ya no está en oferta, su aviso cerrado/pausado no es un problema.
    if ((p.status === "closed" || p.status === "paused") && p.property.status !== "activa") continue;
    const issues = mlIssues(p);
    listings.push({
      id: p.id,
      portal: "mercadolibre",
      externalId: p.externalId ?? "",
      code: p.property.referenceCode,
      title: p.property.publicationTitle,
      address: p.property.address,
      url: p.permalink,
      pictureUrl: p.property.coverImageUrl,
      status: p.status.toUpperCase(),
      published: p.status === "active",
      plan: p.listingTypeId ? (ML_PLAN[p.listingTypeId] ?? p.listingTypeId) : null,
      quality: null,
      issues,
      issuesChangedAt: issues.length ? (p.externalChangeAt ?? p.updatedAt).toISOString() : null,
      property: { id: p.property.id, address: p.property.address },
    });
  }

  // Propiedades en oferta (publicadas en al menos un portal) a las que les falta
  // el aviso en otro. Sólo "activa" no alcanza: hay fichas viejas de Tokko que
  // siguen activas sin estar en venta.
  const publishedBy = new Map<string, Set<string>>();
  for (const l of listings) {
    if (!l.published || !l.property) continue;
    const set = publishedBy.get(l.portal) ?? new Set<string>();
    set.add(l.property.id);
    publishedBy.set(l.portal, set);
  }
  const PORTALS = ["zonaprop", "argenprop", "mercadolibre"];
  const unlisted: DifusionUnlisted[] = activeProps
    .map((p) => ({ ...p, missing: PORTALS.filter((portal) => !publishedBy.get(portal)?.has(p.id)) }))
    .filter((p) => p.missing.length > 0 && p.missing.length < PORTALS.length);

  const stateMap = new Map(states.map((s) => [s.portal, s]));
  const portals: DifusionPortal[] = PORTALS.map((portal) => {
    const st = stateMap.get(portal);
    const mine = listings.filter((l) => l.portal === portal);
    const saved = (st?.summary ?? null) as (PortalSummary & { portal?: Record<string, unknown> | null }) | null;
    return {
      portal,
      // ML se mantiene al día con su propio sync (webhook + cada 15 min).
      syncedAt: portal === "mercadolibre" ? null : st && st.syncedAt.getTime() > 0 ? st.syncedAt.toISOString() : null,
      ok: st?.ok ?? true,
      error: st?.error ?? null,
      summary: summarize(mine),
      portalTotals: saved?.portal ?? null,
      sinAviso: unlisted.filter((u) => u.missing.includes(portal)).length,
    };
  });

  return { portals, listings, unlisted };
}
