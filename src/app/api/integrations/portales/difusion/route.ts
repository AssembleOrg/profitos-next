import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { triggerWorkerDifusionRefresh } from "@/lib/publish/worker-trigger";

// Recorrer los listados de ZP (navegador) y AP puede llevar un par de minutos.
export const maxDuration = 300;

// POST: pide al worker actualizar el panel de Difusión ya (sin esperar la pasada de cada 2 h).
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const r = await triggerWorkerDifusionRefresh();
  const msg = r.ok ? "Difusión actualizada" : `No se pudo actualizar todo (${r.error ?? "worker"}) — se muestra lo último guardado`;
  return ok({ refreshed: r.ok, error: r.error ?? null }, msg, request.nextUrl.pathname);
});
