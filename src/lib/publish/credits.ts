/**
 * Cupo de créditos de publicación de ZonaProp (Simple/Destacado/Súper).
 *
 * Los pagos son por fuera de la app, pero cada plan tiene un CUPO. Este módulo
 * lo lee del portal (GET gratis, no gasta nada) desde el worker (navegador +
 * sesión + proxy) y lo cachea en la DB (jp_portal_credits) para que la web lo
 * muestre sin depender del navegador.
 *
 * Ojo: la forma exacta del JSON de ZonaProp no está 100% relevada (sesión
 * vencida al construir esto). El normalizador es DEFENSIVO y además guardamos el
 * payload crudo (`raw`) para reajustar el parseo con datos reales del deploy.
 */
import { prisma } from "@/lib/prisma/client";
import { fetchCreditsRaw } from "@/lib/zonaprop/browser-publish";

export type PlanCredit = { plan: string; label: string; available: number | null; used: number | null; total: number | null };

const PLAN_META: { value: string; label: string; match: RegExp }[] = [
  { value: "1", label: "Súper Destacado", match: /super|súper|premium|platinum/i },
  { value: "2", label: "Destacado", match: /destac|highlight|gold|silver/i },
  { value: "3", label: "Simple", match: /simple|standard|basic|clasico|clásico/i },
];

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Detecta el plan (1/2/3) de una entrada por código numérico o por nombre. */
function detectPlan(entry: Record<string, unknown>): { value: string; label: string } | null {
  const code =
    entry.publicationPlanId ??
    entry.plan ??
    entry.publicationPlan ??
    entry.publication_plan ??
    entry.planId ??
    entry.id ??
    entry.code;
  const codeStr = code == null ? "" : String(code).trim();
  if (["1", "2", "3"].includes(codeStr)) {
    const m = PLAN_META.find((p) => p.value === codeStr)!;
    return { value: m.value, label: m.label };
  }
  const name = String(entry.name ?? entry.type ?? entry.productType ?? entry.description ?? code ?? "");
  const byName = PLAN_META.find((p) => p.match.test(name));
  return byName ? { value: byName.value, label: byName.label } : null;
}

function pickAvailable(e: Record<string, unknown>): number | null {
  return (
    num(e.availableItems) ??
    num(e.available) ??
    num(e.remaining) ??
    num(e.availableCredits) ??
    num(e.stock) ??
    num(e.quantity) ??
    num(e.cantidad) ??
    num(e.credits) ??
    null
  );
}

/**
 * Forma real de /avisos-api/credits (relevada 2026-08-29):
 *   { branchCredits: [{ creditItems: [
 *       { publicationPlanId, publicationType, name, availableItems,
 *         consumedItems, purchasedItems, isDevelopment } ], branchName }] }
 * Extrae los creditItems de todas las sucursales (sumando por plan si hay más
 * de una). Cae a un scan genérico si el payload viniera distinto.
 */
export function normalizeCredits(raw: unknown): PlanCredit[] {
  const root = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
  const creditsResp = (root.credits as Record<string, unknown> | undefined) ?? root;

  const items: Record<string, unknown>[] = [];
  const branches = creditsResp?.branchCredits;
  if (Array.isArray(branches)) {
    for (const b of branches) {
      const ci = (b as Record<string, unknown>)?.creditItems;
      if (Array.isArray(ci)) items.push(...(ci as Record<string, unknown>[]));
    }
  }

  const byPlan = new Map<string, PlanCredit>();
  for (const e of items) {
    if (e.isDevelopment === true) continue; // planes de "Desarrollo": no son el cupo estándar
    const p = detectPlan(e);
    if (!p) continue; // sólo 1/2/3 (Simple/Destacado/Súper)
    const available = pickAvailable(e);
    const used = num(e.consumedItems) ?? num(e.used) ?? num(e.consumed);
    const total = num(e.purchasedItems) ?? num(e.total) ?? (available != null && used != null ? available + used : null);
    const prev = byPlan.get(p.value);
    // Si hay varias sucursales, sumamos el cupo del mismo plan.
    byPlan.set(p.value, {
      plan: p.value,
      label: p.label,
      available: (prev?.available ?? 0) + (available ?? 0),
      used: (prev?.used ?? 0) + (used ?? 0),
      total: (prev?.total ?? 0) + (total ?? 0),
    });
  }

  // Fallback genérico si no hubo branchCredits (payload inesperado).
  if (byPlan.size === 0) {
    const buckets: Record<string, unknown>[] = [];
    const visit = (v: unknown) => {
      if (Array.isArray(v)) v.forEach((x) => x && typeof x === "object" && buckets.push(x as Record<string, unknown>));
      else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        for (const k of ["credits", "plans", "publicationPlans", "creditItems", "branchCredits", "data", "items", "result"])
          if (o[k]) visit(o[k]);
      }
    };
    visit(raw);
    for (const e of buckets) {
      const p = detectPlan(e);
      if (!p || e.isDevelopment === true) continue;
      const available = pickAvailable(e);
      const used = num(e.consumedItems) ?? num(e.used) ?? num(e.consumed);
      const total = num(e.purchasedItems) ?? num(e.total) ?? (available != null && used != null ? available + used : null);
      if (!byPlan.has(p.value)) byPlan.set(p.value, { plan: p.value, label: p.label, available, used, total });
    }
  }

  // Orden fijo: Simple, Destacado, Súper (3,2,1).
  return ["3", "2", "1"].map((v) => byPlan.get(v)).filter((x): x is PlanCredit => Boolean(x));
}

/**
 * Lee el cupo en vivo desde ZonaProp (GET gratis) y lo cachea en la DB.
 * Devuelve los planes normalizados. Guarda el crudo para reajustes.
 */
export async function refreshZonapropCredits(): Promise<PlanCredit[]> {
  try {
    // Usa la infra probada del publish (withPublishPage + getInPage): navega al
    // panel del publicador y hace el GET in-page con los headers del panel
    // (sessionid + x-panel-portal). En el worker esto funciona; withPortalPage a
    // /panel/avisos dejaba el documento en un origen donde el fetch fallaba.
    const raw = await fetchCreditsRaw();
    const st = raw.credits?.status ?? 0;
    if (st === 401 || st === 403) throw new Error(`Créditos: ${st} (sesión ZonaProp — reconectá el portal)`);
    if (st === 0) {
      throw new Error(`Créditos: no cargó la página (${raw.pageUrl ?? "?"}): ${raw.credits?.bodySnippet ?? "sin detalle"}`);
    }
    const normalized = normalizeCredits({ credits: raw.credits?.json, plans: raw.plans?.json });
    await prisma.portalCredits.upsert({
      where: { portal: "zonaprop" },
      create: { portal: "zonaprop", plans: normalized, raw: raw as object, error: null, fetchedAt: new Date() },
      update: { plans: normalized, raw: raw as object, error: null, fetchedAt: new Date() },
    });
    return normalized;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    await prisma.portalCredits
      .upsert({
        where: { portal: "zonaprop" },
        create: { portal: "zonaprop", plans: [], raw: undefined, error: msg, fetchedAt: new Date() },
        update: { error: msg, fetchedAt: new Date() },
      })
      .catch(() => {});
    throw e;
  }
}
