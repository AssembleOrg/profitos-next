import { prisma } from "@/lib/prisma/client";
import { enqueuePublish } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";
import { syncMlPublication } from "@/lib/mercadolibre/publish-property";

/**
 * Re-sincroniza los avisos existentes de una propiedad con sus datos actuales
 * (después de editar precio, título o descripción).
 *  - mercadolibre: PUT directo al item (API oficial).
 *  - zonaprop: job "update" (STEP_DESCRIPTION + STEP_PRICE en el navegador del worker).
 *  - argenprop: no soportado (la edición se hace en Gestión de ArgenProp).
 */
export type SyncOutcome = { portal: string; ok: boolean; encolado?: boolean; detalle: string };

export async function syncPublications(propertyId: string, portales?: string[]): Promise<SyncOutcome[]> {
  const pubs = await prisma.propertyPublication.findMany({
    where: { propertyId, externalId: { not: null }, status: { in: ["active", "paused", "draft"] } },
    select: { portal: true, status: true },
  });
  const wanted = portales?.length ? pubs.filter((p) => portales.includes(p.portal)) : pubs;
  const out: SyncOutcome[] = [];
  let enqueued = false;
  for (const p of wanted) {
    try {
      if (p.portal === "mercadolibre") {
        const r = await syncMlPublication(propertyId);
        out.push({ portal: p.portal, ok: true, detalle: `Aviso actualizado en MercadoLibre (${r.status})${r.permalink ? ` ${r.permalink}` : ""}` });
      } else if (p.portal === "zonaprop") {
        await enqueuePublish(propertyId, "zonaprop", { action: "update" });
        enqueued = true;
        out.push({ portal: p.portal, ok: true, encolado: true, detalle: "Actualización de título, descripción y precio encolada; el worker la aplica en unos minutos" });
      } else {
        out.push({ portal: p.portal, ok: false, detalle: "ArgenProp no se re-sincroniza desde el sistema: se edita en Gestión de ArgenProp" });
      }
    } catch (err) {
      out.push({ portal: p.portal, ok: false, detalle: err instanceof Error ? err.message : String(err) });
    }
  }
  if (enqueued) await triggerWorkerProcess();
  return out;
}
