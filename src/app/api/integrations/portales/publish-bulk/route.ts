import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { enqueuePublish, isPublishPortal } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";
import { assertReadyToPublish } from "@/lib/publish/ready-guard";

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
    responsibleUserId?: string;
  };

  if (!body.propertyId) throw new AppError(400, "Falta propertyId");
  const portals = (body.portals ?? []).filter(isPublishPortal);
  if (!portals.length) throw new AppError(400, "Elegí al menos un portal válido (zonaprop, argenprop)");

  const property = await prisma.property.findUnique({ where: { id: body.propertyId }, select: { id: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");
  await assertReadyToPublish(body.propertyId, portals);

  const queued: { portal: string; jobId: string }[] = [];
  const skipped: { portal: string; reason: string }[] = [];
  for (const portal of portals) {
    try {
      const jobId = await enqueuePublish(body.propertyId, portal, {
        activate: Boolean(body.activate),
        plan: body.plan,
        responsibleUserId: body.responsibleUserId,
      });
      queued.push({ portal, jobId });
    } catch (err) {
      // Ej: ArgenProp con ficha ya creada → no se duplica, los demás siguen.
      if (err instanceof AppError && err.statusCode === 409) skipped.push({ portal, reason: err.message });
      else throw err;
    }
  }
  if (!queued.length && skipped.length) throw new AppError(409, skipped.map((s) => s.reason).join(" "));
  if (queued.length) await triggerWorkerProcess(); // despierta al worker para procesar ya (no esperar al tick)
  const msg = body.activate ? "Publicación (activar) encolada" : "Borrador encolado";
  const extra = skipped.length ? ` ${skipped.map((s) => s.reason).join(" ")}` : "";
  return ok({ queued, skipped }, `${msg} en ${queued.length} portal(es).${extra}`, path);
});
