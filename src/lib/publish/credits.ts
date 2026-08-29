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
import { withPortalPage, fetchJsonInPage } from "@/lib/scraper/session";

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
  const code = entry.plan ?? entry.publicationPlan ?? entry.publication_plan ?? entry.planId ?? entry.id ?? entry.code;
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

/** Convierte el payload crudo del portal en una lista de planes con cupo. */
export function normalizeCredits(raw: unknown): PlanCredit[] {
  // Junta todos los arrays candidatos que aparezcan en el payload.
  const buckets: Record<string, unknown>[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach((x) => x && typeof x === "object" && buckets.push(x as Record<string, unknown>));
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of ["credits", "plans", "publicationPlans", "data", "items", "result"]) if (o[k]) visit(o[k]);
    }
  };
  visit(raw);

  const byPlan = new Map<string, PlanCredit>();
  for (const e of buckets) {
    const p = detectPlan(e);
    if (!p) continue;
    const available = pickAvailable(e);
    const used = num(e.used) ?? num(e.consumed) ?? num(e.consumidos);
    const total = num(e.total) ?? num(e.cupo) ?? (available != null && used != null ? available + used : null);
    // Si un plan aparece más de una vez, nos quedamos con el que tenga más datos.
    const prev = byPlan.get(p.value);
    if (!prev || (available != null && prev.available == null)) {
      byPlan.set(p.value, { plan: p.value, label: p.label, available, used, total });
    }
  }
  // Orden fijo: Simple, Destacado, Súper (3,2,1).
  return ["3", "2", "1"].map((v) => byPlan.get(v)).filter((x): x is PlanCredit => Boolean(x));
}

const CREDITS_URL = "https://www.zonaprop.com.ar/avisos-api/credits";
const PLANS_URL =
  "https://www.zonaprop.com.ar/avisos-api/panel/api/v2/credits/publicationplans?operationType=2&publisherType=2";

/**
 * Lee el cupo en vivo desde ZonaProp (GET gratis) y lo cachea en la DB.
 * Devuelve los planes normalizados. Guarda el crudo para reajustes.
 */
export async function refreshZonapropCredits(): Promise<PlanCredit[]> {
  try {
    const raw = await withPortalPage("zonaprop", "https://www.zonaprop.com.ar/panel/avisos", async (page) => {
      const credits = await fetchJsonInPage(page, CREDITS_URL, "zonaprop").catch(() => null);
      const plans = await fetchJsonInPage(page, PLANS_URL, "zonaprop").catch(() => null);
      return { credits, plans };
    });
    const normalized = normalizeCredits(raw);
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
