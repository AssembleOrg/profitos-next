import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

// Fotos de una propiedad, bajo demanda (el listado paginado NO las trae:
// son ~20 por propiedad y engordaban el payload). Se piden al abrir el modal.
export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const property = await prisma.property.findUnique({
    where: { id },
    select: { photos: true, coverImageUrl: true },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  type RawPhoto = {
    image?: string | null;
    thumb?: string | null;
    original?: string | null;
    order?: number;
    description?: string;
    is_front_cover?: boolean;
    is_blueprint?: boolean;
  };
  const raw = (Array.isArray(property.photos) ? property.photos : []) as RawPhoto[];
  const photos = raw
    .map((p, i) => ({
      image: p.image ?? null,
      thumb: p.thumb ?? p.image ?? null,
      original: p.original ?? p.image ?? null,
      order: p.order ?? i + 1,
      description: p.description || null,
      isFrontCover: Boolean(p.is_front_cover),
      isBlueprint: Boolean(p.is_blueprint),
    }))
    .filter((p) => p.image)
    .sort((a, b) => a.order - b.order);

  return ok({ photos, coverImageUrl: property.coverImageUrl }, "Fotos obtenidas", path);
});
