import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { getItem } from "@/lib/mercadolibre/items";
import { reconcileMlPublication } from "@/lib/mercadolibre/watch";
import { changePublicationState, STATE_ACTIONS, type StateAction } from "@/lib/publish/state";

// Estado de la publicación de MercadoLibre para una propiedad.
// Refresca el estado real desde ML (evita desincronización si el webhook no llegó).
export const GET = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { propertyId } = (await context!.params) as { propertyId: string };
  let publication = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
  });

  if (publication?.externalId) {
    try {
      const item = await getItem(publication.externalId);
      publication = (await reconcileMlPublication(publication, item)) ?? publication;
    } catch {
      // si ML no responde, devolvemos lo que hay en DB
    }
  }

  return ok(publication, "Publicación", request.nextUrl.pathname);
});

// Cambia el estado del item en ML: pause | activate | close.
export const PATCH = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { propertyId } = (await context!.params) as { propertyId: string };
  const path = request.nextUrl.pathname;
  const { action } = (await request.json()) as { action?: StateAction };
  if (!action || !STATE_ACTIONS.includes(action)) throw new AppError(400, "Acción inválida");

  await changePublicationState(propertyId, ML_PORTAL, action);
  const updated = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
  });
  return ok(updated, "Estado actualizado", path);
});
