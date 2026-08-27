import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { MlApiError } from "@/lib/mercadolibre/client";
import { publishItem, updateItem, type MlPublishInput } from "@/lib/mercadolibre/items";

// Publica (o re-publica/edita) una propiedad en MercadoLibre.
// Body: { propertyId, input: MlPublishInput }
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const body = (await request.json()) as { propertyId?: string; input?: MlPublishInput };
  const { propertyId, input } = body;

  if (!propertyId) throw new AppError(400, "Falta propertyId");
  if (!input?.title || !input.categoryId || !input.listingTypeId) {
    throw new AppError(400, "Faltan datos obligatorios (título, categoría o tipo de publicación)");
  }
  if (!input.pictures?.length) throw new AppError(400, "Se requiere al menos una foto");

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  const existing = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
  });

  // Marca "publishing" antes de llamar a ML.
  await prisma.propertyPublication.upsert({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
    create: {
      propertyId,
      portal: ML_PORTAL,
      status: "publishing",
      categoryId: input.categoryId,
      listingTypeId: input.listingTypeId,
      lastPayload: input as object,
    },
    update: {
      status: "publishing",
      categoryId: input.categoryId,
      listingTypeId: input.listingTypeId,
      lastPayload: input as object,
      lastError: null,
    },
  });

  try {
    const item =
      existing?.externalId
        ? await updateItem(existing.externalId, input)
        : await publishItem(input);

    const publication = await prisma.propertyPublication.update({
      where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
      data: {
        externalId: item.id,
        status: item.status === "active" ? "active" : item.status ?? "active",
        permalink: item.permalink ?? null,
        publishedAt: existing?.publishedAt ?? new Date(),
        lastError: null,
      },
    });

    // Guarda el link público en la propiedad para acceso rápido.
    if (item.permalink && property.publicUrl !== item.permalink) {
      await prisma.property.update({
        where: { id: propertyId },
        data: { publicUrl: item.permalink },
      });
    }

    return ok(publication, existing?.externalId ? "Publicación actualizada" : "Publicado en MercadoLibre", path);
  } catch (err) {
    const detail = describeMlError(err);
    await prisma.propertyPublication.update({
      where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
      data: { status: "error", lastError: detail },
    });
    throw new AppError(err instanceof MlApiError ? err.status || 502 : 502, detail);
  }
});

function describeMlError(err: unknown): string {
  if (err instanceof MlApiError) {
    const body = err.body as { cause?: Array<{ message?: string; code?: string }> } | undefined;
    const causes = body?.cause?.map((c) => c.message).filter(Boolean);
    if (causes?.length) return `MercadoLibre: ${causes.join(" · ")}`;
    return `MercadoLibre: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Error al publicar en MercadoLibre";
}
