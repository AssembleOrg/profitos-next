import { prisma } from "@/lib/prisma/client";
import type { PlanCredit } from "@/lib/publish/credits";

/** Umbral de alerta de cupo de ZonaProp (créditos disponibles por plan). */
export const ZP_CREDITS_ALERT = Math.max(0, Number(process.env.ZONAPROP_CREDITS_ALERT ?? 3));

export type CreditsAlert = {
  umbral: number;
  planes: PlanCredit[];
  /** Planes con `available` <= umbral (sin contar los que no informan). */
  enAlerta: { plan: string; disponibles: number; total: number | null }[];
  actualizado: Date | null;
  error: string | null;
};

/** Lee el cupo cacheado de ZonaProp y marca los planes por debajo del umbral. */
export async function zonapropCreditsAlert(): Promise<CreditsAlert> {
  const row = await prisma.portalCredits.findUnique({ where: { portal: "zonaprop" }, select: { plans: true, fetchedAt: true, error: true } });
  const planes = (Array.isArray(row?.plans) ? row!.plans : []) as PlanCredit[];
  const enAlerta = planes
    .filter((p) => typeof p.available === "number" && p.available <= ZP_CREDITS_ALERT)
    .map((p) => ({ plan: p.label || p.plan, disponibles: p.available as number, total: p.total ?? null }));
  return { umbral: ZP_CREDITS_ALERT, planes, enAlerta, actualizado: row?.fetchedAt ?? null, error: row?.error ?? null };
}
