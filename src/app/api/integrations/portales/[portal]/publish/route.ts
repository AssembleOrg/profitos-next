import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { enqueuePublish, isPublishPortal } from "@/lib/publish/portales";

// Encola la publicación de una propiedad en un portal (ZonaProp/ArgenProp).
// El worker de Railway procesa la cola (necesita navegador+proxy).
// Body: { propertyId }
export const POST = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const { portal } = (await context!.params) as { portal: string };
  if (!isPublishPortal(portal)) throw new AppError(400, `Portal no soportado: ${portal}`);

  const body = (await request.json().catch(() => ({}))) as { propertyId?: string };
  if (!body.propertyId) throw new AppError(400, "Falta propertyId");

  const property = await prisma.property.findUnique({ where: { id: body.propertyId }, select: { id: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  const jobId = await enqueuePublish(body.propertyId, portal);
  return ok({ queued: true, jobId, portal }, "Publicación encolada", path);
});
