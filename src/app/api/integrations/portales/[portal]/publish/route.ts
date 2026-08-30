import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { enqueuePublish, isPublishPortal } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";

// Encola la publicación de una propiedad en un portal (ZonaProp/ArgenProp).
// El worker de Railway procesa la cola (necesita navegador+proxy).
// Body: { propertyId }
export const POST = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const { portal } = (await context!.params) as { portal: string };
  if (!isPublishPortal(portal)) throw new AppError(400, `Portal no soportado: ${portal}`);

  const body = (await request.json().catch(() => ({}))) as {
    propertyId?: string;
    activate?: boolean;
    plan?: string;
    responsibleUserId?: string;
  };
  if (!body.propertyId) throw new AppError(400, "Falta propertyId");

  const property = await prisma.property.findUnique({ where: { id: body.propertyId }, select: { id: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  // activate:true PUBLICA (gasta 1 crédito del plan); false = solo borrador.
  const jobId = await enqueuePublish(body.propertyId, portal, {
    activate: Boolean(body.activate),
    plan: body.plan,
    responsibleUserId: body.responsibleUserId,
  });
  await triggerWorkerProcess(); // despierta al worker para procesar ya (no esperar al tick)
  const msg = body.activate ? "Publicación (activar) encolada" : "Borrador encolado";
  return ok({ queued: true, jobId, portal, activate: Boolean(body.activate) }, msg, path);
});
