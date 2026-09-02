import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";
import { changePublicationState, type StateAction } from "@/lib/publish/state";
import { enqueuePublish, isPublishPortal } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";

// Tool del chat IA: GESTIÓN de publicaciones en portales (con confirmación del
// lado del chat). Acciones:
//  - pausar / dar_de_baja / reactivar: ArgenProp y MercadoLibre (ZonaProp NO:
//    decisión de negocio, los estados de ZonaProp no se tocan desde acá).
//  - publicar: ZonaProp y ArgenProp (encola el job del worker). MercadoLibre
//    se publica desde el wizard de la web.
const ACCIONES = ["pausar", "dar_de_baja", "reactivar", "publicar"] as const;
type Accion = (typeof ACCIONES)[number];
const TO_STATE: Record<Exclude<Accion, "publicar">, StateAction> = {
  pausar: "pause",
  dar_de_baja: "close",
  reactivar: "activate",
};
const PORTALES = ["zonaprop", "argenprop", "mercadolibre"] as const;

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as {
    propertyId?: string;
    referencia?: string;
    direccion?: string;
    portal?: string;
    accion?: string;
    plan?: string;
  };
  const portal = (body.portal ?? "").trim().toLowerCase();
  const accion = (body.accion ?? "").trim().toLowerCase() as Accion;
  if (!(PORTALES as readonly string[]).includes(portal)) throw new AppError(400, `Portal inválido: "${body.portal}" (zonaprop, argenprop o mercadolibre)`);
  if (!ACCIONES.includes(accion)) throw new AppError(400, `Acción inválida: "${body.accion}" (pausar, dar_de_baja, reactivar o publicar)`);

  const prop = await resolveProperty(body);
  const path = request.nextUrl.pathname;

  if (accion === "publicar") {
    if (!isPublishPortal(portal)) {
      throw new AppError(400, "MercadoLibre se publica desde la web (Propiedades → Portales → MercadoLibre); no está disponible desde el chat.");
    }
    const pub = await prisma.propertyPublication.findUnique({
      where: { propertyId_portal: { propertyId: prop.id, portal } },
      select: { status: true, externalId: true },
    });
    if (pub?.externalId && (pub.status === "active" || pub.status === "publishing")) {
      throw new AppError(409, `${prop.direccion} ya está publicada en ${portal} (estado ${pub.status}). Si querés reactivarla usá "reactivar".`);
    }
    const jobId = await enqueuePublish(prop.id, portal, { activate: true, plan: body.plan?.trim() || undefined });
    await triggerWorkerProcess();
    console.log(`[chat-tools] ${who.email} encoló publicar ${prop.id} en ${portal} (job ${jobId})`);
    return ok(
      { propiedad: prop, portal, accion, jobId, encolado: true },
      `Publicación de ${prop.direccion} en ${portal} encolada; el worker la procesa en unos minutos y el estado se ve en Propiedades → Portales.`,
      path
    );
  }

  if (portal === "zonaprop") {
    throw new AppError(400, "Los cambios de estado en ZonaProp no se hacen desde el sistema: pausar/dar de baja se hace desde el panel de ZonaProp.");
  }
  const { result, message } = await changePublicationState(prop.id, portal, TO_STATE[accion]);
  console.log(`[chat-tools] ${who.email} ${accion} ${prop.id} en ${portal}`);
  return ok({ propiedad: prop, accion, ...result }, `${prop.direccion}: ${message}`, path);
});
