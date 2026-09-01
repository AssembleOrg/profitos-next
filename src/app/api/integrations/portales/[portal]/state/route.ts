import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { enqueuePublish } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";
import { setItemStatus } from "@/lib/mercadolibre/items";

// Cambia el estado de una publicación YA existente en un portal.
// Body: { propertyId, action: "pause" | "close" | "activate" }
//  - mercadolibre: directo vía API oficial (pausar/reactivar/cerrar).
//  - argenprop: encola un job (el worker sale por proxy) → SUSPENDIDO/ELIMINADO/VIGENTE.
//  - zonaprop: no soportado aún.
const ACTIONS = ["pause", "close", "activate"] as const;
type Action = (typeof ACTIONS)[number];

const ML_STATUS: Record<Action, "paused" | "closed" | "active"> = {
  pause: "paused",
  close: "closed",
  activate: "active",
};

export const POST = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const { portal } = (await context!.params) as { portal: string };
  const body = (await request.json().catch(() => ({}))) as { propertyId?: string; action?: string };

  if (!body.propertyId) throw new AppError(400, "Falta propertyId");
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) throw new AppError(400, `Acción inválida: ${body.action}`);

  const pub = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId: body.propertyId, portal } },
    select: { externalId: true, status: true },
  });
  if (!pub?.externalId) throw new AppError(404, "La propiedad no tiene aviso vinculado en ese portal");

  if (portal === "mercadolibre") {
    if (action === "activate" && pub.status === "closed") {
      throw new AppError(400, "En MercadoLibre una publicación cerrada no se puede reactivar (hay que republicar)");
    }
    const status = ML_STATUS[action];
    await setItemStatus(pub.externalId, status);
    await prisma.propertyPublication.update({
      where: { propertyId_portal: { propertyId: body.propertyId, portal } },
      data: { status, lastError: null },
    });
    return ok({ portal, action, status }, "Estado actualizado en MercadoLibre", path);
  }

  if (portal === "argenprop") {
    const jobId = await enqueuePublish(body.propertyId, "argenprop", { action });
    await triggerWorkerProcess(); // que el worker lo aplique ya
    return ok({ portal, action, queued: true, jobId }, "Cambio de estado encolado (se aplica en segundos)", path);
  }

  throw new AppError(400, `Cambio de estado no soportado para ${portal}`);
});
