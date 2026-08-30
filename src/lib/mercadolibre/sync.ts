import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { getItem } from "@/lib/mercadolibre/items";

/**
 * Refresca el estado real de todas las publicaciones ML (menos las cerradas)
 * contra la API de ML y actualiza la DB. Corrige chips desincronizados (ej: un
 * aviso pausado por ML que en la web seguía figurando activo).
 *
 * Usa la API oficial de ML (token OAuth) — NO necesita navegador ni proxy, así
 * que puede correr en el worker sin el mutex del scraper.
 */
export async function syncMlPublications(): Promise<{ total: number; updated: number }> {
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
  return { total: publications.length, updated };
}
