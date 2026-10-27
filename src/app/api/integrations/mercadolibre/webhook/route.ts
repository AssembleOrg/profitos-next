import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { ML, ML_PORTAL } from "@/lib/mercadolibre/config";
import { getItem, getQuestion } from "@/lib/mercadolibre/items";
import { upsertPortalQuestion } from "@/lib/mercadolibre/questions";
import { reconcileMlPublication } from "@/lib/mercadolibre/watch";
import { handleMlLeadNotification } from "@/lib/mercadolibre/leads";

// Webhook de notificaciones de MercadoLibre (topics: items, questions, vis_leads).
// Público: ML hace POST sin sesión. SIEMPRE responde 200 rápido para no
// disparar reintentos; el procesamiento va en try/catch y nunca tira.
// Seguridad: con ML_WEBHOOK_SECRET se exige ?token= o application_id de nuestra app.

interface MlNotification {
  resource?: string; // "/items/MLA123" | "/questions/5000"
  topic?: string; // "items" | "questions" | ...
  user_id?: number;
  application_id?: number;
  attempts?: number;
  sent?: string;
  received?: string;
}

function lastSegment(resource: string | undefined): string | null {
  if (!resource) return null;
  const parts = resource.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

async function handleItem(itemId: string) {
  const publication = await prisma.propertyPublication.findFirst({
    where: { portal: ML_PORTAL, externalId: itemId },
  });
  if (!publication) return; // no es un aviso nuestro
  const item = await getItem(itemId);
  await reconcileMlPublication(publication, item);
}

async function handleQuestion(questionId: string) {
  const q = await getQuestion(questionId);
  await upsertPortalQuestion(q);
}

async function handleNotification(notif: MlNotification) {
  const topic = notif.topic ?? notif.resource?.split("/").filter(Boolean)[0];
  const id = lastSegment(notif.resource);
  if (!id) return;
  if (topic === "items") await handleItem(id);
  else if (topic === "questions") await handleQuestion(id);
  // Interesados (tocó WhatsApp / Llamar): resource "/vis/leads/{id}".
  else if (topic === "vis_leads" || notif.resource?.startsWith("/vis/leads/")) await handleMlLeadNotification(id);
  // otros topics: ignorados
}

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;

  let notif: MlNotification = {};
  try {
    notif = (await request.json()) as MlNotification;
  } catch {
    return ok({ received: true }, "ok", path);
  }

  // Válida si trae el ?token= o si viene dirigida a NUESTRA app de ML (la URL
  // de notificaciones de la app no lleva token y antes se ignoraba todo). No
  // hay riesgo en aceptarla: el handler nunca confía en el contenido, siempre
  // vuelve a consultar el aviso/pregunta a la API de ML con nuestro token.
  const secret = process.env.ML_WEBHOOK_SECRET;
  const tokenOk = !secret || request.nextUrl.searchParams.get("token") === secret;
  const ourApp = Boolean(ML.clientId) && String(notif.application_id ?? "") === ML.clientId;
  if (!tokenOk && !ourApp) {
    // No revelamos nada; devolvemos 200 igual para no filtrar la validez.
    console.warn("[ML webhook] notificación ignorada: sin token y de otra app", notif.application_id);
    return ok({ received: true }, "ok", path);
  }

  try {
    await handleNotification(notif);
  } catch (err) {
    // Nunca fallamos hacia ML; log para diagnóstico.
    console.error("[ML webhook] error procesando notificación:", err, notif);
  }

  return ok({ received: true }, "ok", path);
});

// ML a veces hace un GET de verificación al guardar la app.
export const GET = withHandler(async (request: NextRequest) => {
  return ok({ ok: true }, "ok", request.nextUrl.pathname);
});
