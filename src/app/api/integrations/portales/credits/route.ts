import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { triggerWorkerCreditsRefresh } from "@/lib/publish/worker-trigger";

type PlanCredit = { plan: string; label: string; available: number | null; used: number | null; total: number | null };

async function read(portal: string) {
  const row = await prisma.portalCredits.findUnique({ where: { portal } });
  return {
    plans: (row?.plans as PlanCredit[] | undefined) ?? [],
    fetchedAt: row?.fetchedAt ?? null,
    error: row?.error ?? null,
  };
}

// GET: lee el cupo cacheado en la DB (lo refresca el worker).
export const GET = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  return ok(await read("zonaprop"), "Cupo de créditos", request.nextUrl.pathname);
});

// POST: pide al worker un refresco en vivo y devuelve el cupo actualizado.
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const r = await triggerWorkerCreditsRefresh();
  const data = await read("zonaprop");
  const msg = r.ok ? "Cupo actualizado" : `No se pudo actualizar (${r.error ?? "worker"}) — se muestra lo último guardado`;
  return ok({ ...data, refreshed: r.ok }, msg, request.nextUrl.pathname);
});
