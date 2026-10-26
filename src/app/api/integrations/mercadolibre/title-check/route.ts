import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { findSameTitleItems, suggestUniqueTitle } from "@/lib/mercadolibre/title-check";

// ¿El título ya existe en la cuenta de ML? Lo consulta el wizard mientras se
// escribe, para frenar antes de publicar (ver lib/mercadolibre/title-check.ts).
// GET ?propertyId=…&title=…
export const GET = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const params = request.nextUrl.searchParams;
  const propertyId = params.get("propertyId") ?? "";
  const title = (params.get("title") ?? "").trim();
  if (!propertyId || !title) throw new AppError(400, "Faltan propertyId o title");

  const [property, publication] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { address: true, city: true } }),
    prisma.propertyPublication.findUnique({
      where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
      select: { externalId: true },
    }),
  ]);
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  const duplicates = await findSameTitleItems(title, [publication?.externalId ?? ""]);
  const suggestion = duplicates.length ? suggestUniqueTitle(title, property.address, property.city) : null;
  return ok({ duplicates, suggestion }, duplicates.length ? "Título repetido" : "Título libre", request.nextUrl.pathname);
});
