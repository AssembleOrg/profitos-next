import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { enqueuePublish, isPublishPortal } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";

// Publicación GRUPAL: encola una propiedad en varios portales a la vez.
// Body: { propertyId, portals: ["zonaprop","argenprop"] }
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const body = (await request.json().catch(() => ({}))) as {
    propertyId?: string;
    portals?: string[];
    activate?: boolean;
    plan?: string;
  };

  if (!body.propertyId) throw new AppError(400, "Falta propertyId");
  const portals = (body.portals ?? []).filter(isPublishPortal);
  if (!portals.length) throw new AppError(400, "Elegí al menos un portal válido (zonaprop, argenprop)");

  const property = await prisma.property.findUnique({ where: { id: body.propertyId }, select: { id: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  const queued: { portal: string; jobId: string }[] = [];
  for (const portal of portals) {
    const jobId = await enqueuePublish(body.propertyId, portal, { activate: Boolean(body.activate), plan: body.plan });
    queued.push({ portal, jobId });
  }
  await triggerWorkerProcess(); // despierta al worker para procesar ya (no esperar al tick)
  const msg = body.activate ? "Publicación (activar) encolada" : "Borrador encolado";
  return ok({ queued }, `${msg} en ${queued.length} portal(es)`, path);
});
