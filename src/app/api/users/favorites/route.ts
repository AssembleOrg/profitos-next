import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

const MAX_FAVORITES = 40;

/**
 * Guarda los favoritos del menú del usuario autenticado.
 * Body: { favorites: string[] } — array de hrefs, ej: ["/alquileres", "/tasaciones"].
 */
export const PATCH = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();

  const body = await request.json();
  const { favorites } = body as { favorites?: unknown };

  if (!Array.isArray(favorites) || favorites.some((f) => typeof f !== "string")) {
    throw new AppError(400, "Favoritos inválidos");
  }
  // Normalizar: únicos, sin vacíos, con tope.
  const clean = [...new Set((favorites as string[]).map((f) => f.trim()).filter(Boolean))].slice(0, MAX_FAVORITES);

  await prisma.user.update({
    where: { id: auth.userId },
    data: { navFavorites: clean },
  });

  return ok({ favorites: clean }, "Favoritos actualizados", path);
});
