import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import { enqueuePublish } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";
import { setItemStatus } from "@/lib/mercadolibre/items";

// Cambio de estado de una publicación YA existente en un portal. Lo usan la
// API de la web (panel Portales) y las tools del chat IA.
//  - mercadolibre: directo vía API oficial (pausar/reactivar/cerrar).
//  - argenprop: encola un job (el worker sale por proxy) → SUSPENDIDO/ELIMINADO/VIGENTE.
//  - zonaprop: no soportado (decisión: no tocar estados en ZonaProp).
export const STATE_ACTIONS = ["pause", "close", "activate"] as const;
export type StateAction = (typeof STATE_ACTIONS)[number];

const ML_STATUS: Record<StateAction, "paused" | "closed" | "active"> = {
  pause: "paused",
  close: "closed",
  activate: "active",
};

export type StateChangeResult =
  | { portal: string; action: StateAction; status: string; queued?: false }
  | { portal: string; action: StateAction; queued: true; jobId: string };

export async function changePublicationState(propertyId: string, portal: string, action: StateAction): Promise<{ result: StateChangeResult; message: string }> {
  if (!STATE_ACTIONS.includes(action)) throw new AppError(400, `Acción inválida: ${action}`);

  const pub = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId, portal } },
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
      where: { propertyId_portal: { propertyId, portal } },
      data: { status, lastError: null },
    });
    return { result: { portal, action, status }, message: "Estado actualizado en MercadoLibre" };
  }

  if (portal === "argenprop") {
    const jobId = await enqueuePublish(propertyId, "argenprop", { action });
    await triggerWorkerProcess(); // que el worker lo aplique ya
    return { result: { portal, action, queued: true, jobId }, message: "Cambio de estado encolado (se aplica en segundos)" };
  }

  throw new AppError(400, `Cambio de estado no soportado para ${portal}`);
}
