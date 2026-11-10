import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getOwnerReportStats } from "@/lib/reports/owner-stats";
import { triggerWorkerStatsRefresh } from "@/lib/publish/worker-trigger";

// Datos automáticos del informe al propietario (ZonaProp + consultas + visitas).
// GET  → OwnerReportStats
// POST → pide al worker traerlos YA de ZonaProp y devuelve los nuevos (+ error si no pudo)
async function load(id: string) {
  const property = await prisma.property.findUnique({ where: { id }, select: { id: true, referenceCode: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");
  return getOwnerReportStats(property.id, property.referenceCode);
}

export const GET = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  return ok(await load(id), "Estadísticas obtenidas", request.nextUrl.pathname);
});

export const POST = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  const refresh = await triggerWorkerStatsRefresh(id);
  const stats = await load(id);
  return ok({ ...stats, refresh }, refresh.ok ? "Datos de ZonaProp actualizados" : "No se pudo actualizar", request.nextUrl.pathname);
});
