import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { getItem } from "@/lib/mercadolibre/items";

// Refresca el estado real de todas las publicaciones ML (menos las cerradas)
// contra ML y actualiza la DB. Para corregir chips desincronizados de un tirón.
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;

  const publications = await prisma.propertyPublication.findMany({
    where: { portal: ML_PORTAL, externalId: { not: null }, status: { not: "closed" } },
    select: { id: true, externalId: true, status: true, permalink: true },
  });

  let updated = 0;
  for (const pub of publications) {
    try {
      const item = await getItem(pub.externalId!);
      const changed =
        (item.status && item.status !== pub.status) ||
        (item.permalink && item.permalink !== pub.permalink);
      if (changed) {
        await prisma.propertyPublication.update({
          where: { id: pub.id },
          data: { status: item.status ?? pub.status, permalink: item.permalink ?? pub.permalink },
        });
        updated++;
      }
    } catch {
      // item borrado/inaccesible: se ignora
    }
  }

  return ok({ total: publications.length, updated }, `${updated} publicaciones actualizadas`, path);
});
