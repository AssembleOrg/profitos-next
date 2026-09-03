import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";
import { changePublicationState, type StateAction } from "@/lib/publish/state";
import { enqueuePublish, isPublishPortal } from "@/lib/publish/portales";
import { triggerWorkerProcess } from "@/lib/publish/worker-trigger";
import { buildMlInputFromProperty, publishPropertyToMl, MlNeedsInputError, type MlBuildOpts } from "@/lib/mercadolibre/publish-property";
import { syncPublications } from "@/lib/publish/sync";
import { publishReadiness, faltanTexto, type ReadinessPortal } from "@/lib/publish/readiness";

// Tool del chat IA: GESTIÓN de publicaciones en portales (con confirmación del
// lado del chat). Acciones:
//  - pausar / dar_de_baja / reactivar: ArgenProp, MercadoLibre y ZonaProp
//    (ZonaProp: pausar = finalizar el aviso → OFFLINE; reactivar = republicar
//    con plan, usa cupo; dar de baja = archivar).
//  - publicar: ZonaProp y ArgenProp (encola el job del worker) o MercadoLibre
//    (directo por API; infiere categoría/atributos/ubicación desde la
//    propiedad y devuelve 409 con lo que falte para que el bot pregunte).
//  - sincronizar: re-sincroniza los avisos existentes con los datos actuales
//    de la propiedad (ML directo, ZonaProp vía worker; ArgenProp no).
const ACCIONES = ["pausar", "dar_de_baja", "reactivar", "publicar", "sincronizar"] as const;
type Accion = (typeof ACCIONES)[number];
const TO_STATE: Record<"pausar" | "dar_de_baja" | "reactivar", StateAction> = {
  pausar: "pause",
  dar_de_baja: "close",
  reactivar: "activate",
};
const PORTALES = ["zonaprop", "argenprop", "mercadolibre"] as const;

// "Simple"/"Destacado"/"Súper Destacado" → código de plan de ZonaProp.
function zpPlanCode(plan?: string): string | undefined {
  const p = (plan ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!p) return undefined;
  if (/^[123]$/.test(p)) return p;
  if (p.includes("super")) return "1";
  if (p.includes("destac")) return "2";
  if (p.includes("simple")) return "3";
  return plan?.trim();
}

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
    // MercadoLibre (publicar):
    tipoPublicacion?: string;
    categoriaId?: string;
    atributos?: Record<string, string | number>;
    provincia?: string;
    ciudad?: string;
  };
  const portal = (body.portal ?? "").trim().toLowerCase();
  const accion = (body.accion ?? "").trim().toLowerCase() as Accion;
  if (!ACCIONES.includes(accion)) throw new AppError(400, `Acción inválida: "${body.accion}" (${ACCIONES.join(", ")})`);
  if (accion !== "sincronizar" && !(PORTALES as readonly string[]).includes(portal)) {
    throw new AppError(400, `Portal inválido: "${body.portal}" (zonaprop, argenprop o mercadolibre)`);
  }

  const prop = await resolveProperty(body);
  const path = request.nextUrl.pathname;

  if (accion === "sincronizar") {
    const portales = portal ? [portal] : undefined;
    const resultados = await syncPublications(prop.id, portales);
    if (!resultados.length) throw new AppError(404, `${prop.direccion} no tiene avisos vinculados${portal ? ` en ${portal}` : ""} para sincronizar`);
    console.log(`[chat-tools] ${who.email} sincronizó ${prop.id}: ${resultados.map((r) => `${r.portal}=${r.ok ? "ok" : "error"}`).join(", ")}`);
    return ok({ propiedad: prop, resultados }, `Sincronización de ${prop.direccion}: ${resultados.map((r) => `${r.portal}: ${r.detalle}`).join(" | ")}`, path);
  }

  if (accion === "publicar") {
    const pub = await prisma.propertyPublication.findUnique({
      where: { propertyId_portal: { propertyId: prop.id, portal } },
      select: { status: true, externalId: true },
    });
    if (pub?.externalId && (pub.status === "active" || pub.status === "publishing")) {
      throw new AppError(409, `${prop.direccion} ya está publicada en ${portal} (estado ${pub.status}). Si querés actualizar el aviso usá "sincronizar"; si está pausada, "reactivar".`);
    }

    // Validación de "listo para publicar": campos mínimos que el portal exige.
    // Si faltan, 409 con la lista para que el bot los pida y complete con editar_propiedad.
    const full = await prisma.property.findUnique({
      where: { id: prop.id },
      select: { type: true, operationType: true, operationPrice: true, operationCurrency: true, publicationTitle: true, address: true, province: true, city: true, geoLat: true, geoLong: true, photos: true, coverImageUrl: true },
    });
    if (full) {
      const r = publishReadiness(full, portal as ReadinessPortal);
      if (!r.ok) {
        throw new AppError(409, `No se puede publicar ${prop.direccion} en ${portal} todavía: faltan campos obligatorios (${faltanTexto(r)}). Preguntale al usuario esos datos y completalos con editar_propiedad; después reintentá publicar.`);
      }
    }

    if (portal === "mercadolibre") {
      const opts: MlBuildOpts = {
        tipoPublicacion: body.tipoPublicacion,
        categoriaId: body.categoriaId,
        atributos: body.atributos,
        provincia: body.provincia,
        ciudad: body.ciudad,
      };
      let built;
      try {
        built = await buildMlInputFromProperty(prop.id, opts);
      } catch (err) {
        if (err instanceof MlNeedsInputError) {
          throw new AppError(409, `${err.message}. Detalle: ${JSON.stringify(err.detalle)}`);
        }
        throw err;
      }
      const { publication, updated } = await publishPropertyToMl(prop.id, built.input);
      console.log(`[chat-tools] ${who.email} publicó ${prop.id} en mercadolibre (${publication.externalId})`);
      return ok(
        { propiedad: prop, portal, accion, estado: publication.status, permalink: publication.permalink, resumen: built.resumen },
        `${prop.direccion} ${updated ? "actualizada" : "publicada"} en MercadoLibre (${publication.status})${publication.permalink ? `: ${publication.permalink}` : ""}`,
        path
      );
    }

    if (!isPublishPortal(portal)) throw new AppError(400, `No se puede publicar en ${portal}`);
    const jobId = await enqueuePublish(prop.id, portal, { activate: true, plan: zpPlanCode(body.plan) });
    await triggerWorkerProcess();
    console.log(`[chat-tools] ${who.email} encoló publicar ${prop.id} en ${portal} (job ${jobId})`);
    return ok(
      { propiedad: prop, portal, accion, jobId, encolado: true },
      `Publicación de ${prop.direccion} en ${portal} encolada; el worker la procesa en unos minutos y el estado se ve en Propiedades → Portales.`,
      path
    );
  }

  const { result, message } = await changePublicationState(prop.id, portal, TO_STATE[accion], { plan: zpPlanCode(body.plan) });
  console.log(`[chat-tools] ${who.email} ${accion} ${prop.id} en ${portal}`);
  return ok({ propiedad: prop, accion, ...result }, `${prop.direccion}: ${message}`, path);
});
