import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { setItemStatus } from "@/lib/mercadolibre/items";

// Estado de la publicación de MercadoLibre para una propiedad.
export const GET = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { propertyId } = (await context!.params) as { propertyId: string };
  const publication = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
  });
  return ok(publication, "Publicación", request.nextUrl.pathname);
});

// Cambia el estado del item en ML: pause | activate | close.
export const PATCH = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { propertyId } = (await context!.params) as { propertyId: string };
  const path = request.nextUrl.pathname;
  const { action } = (await request.json()) as { action?: "pause" | "activate" | "close" };

  const publication = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
  });
  if (!publication?.externalId) throw new AppError(404, "La propiedad no está publicada en MercadoLibre");

  const map = { pause: "paused", activate: "active", close: "closed" } as const;
  const target = action ? map[action] : undefined;
  if (!target) throw new AppError(400, "Acción inválida");

  const item = await setItemStatus(publication.externalId, target);
  const updated = await prisma.propertyPublication.update({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
    data: { status: item.status ?? target },
  });
  return ok(updated, "Estado actualizado", path);
});
