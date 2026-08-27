import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { getItem, getQuestion } from "@/lib/mercadolibre/items";
import { upsertPortalQuestion } from "@/lib/mercadolibre/questions";

// Webhook de notificaciones de MercadoLibre (topics: items, questions).
// Público: ML hace POST sin sesión. SIEMPRE responde 200 rápido para no
// disparar reintentos; el procesamiento va en try/catch y nunca tira.
// Seguridad opcional: si ML_WEBHOOK_SECRET está seteado, se exige ?token=.

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
  await prisma.propertyPublication.update({
    where: { id: publication.id },
    data: {
      status: item.status ?? publication.status,
      permalink: item.permalink ?? publication.permalink,
    },
  });
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
  // otros topics: ignorados
}

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const secret = process.env.ML_WEBHOOK_SECRET;
  if (secret && request.nextUrl.searchParams.get("token") !== secret) {
    // No revelamos nada; devolvemos 200 igual para no filtrar la validez.
    return ok({ received: true }, "ok", path);
  }

  let notif: MlNotification = {};
  try {
    notif = (await request.json()) as MlNotification;
  } catch {
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
