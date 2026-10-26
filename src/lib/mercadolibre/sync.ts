import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { getItem } from "@/lib/mercadolibre/items";
import { reconcileMlPublication } from "@/lib/mercadolibre/watch";

/**
 * Refresca el estado real de todas las publicaciones ML (menos las cerradas)
 * contra la API de ML y actualiza la DB. Si un aviso se cerró/pausó sin que lo
 * pidiera el sistema, queda marcado como alerta (ver watch.ts). Corrige chips desincronizados (ej: un
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
      if (await reconcileMlPublication(pub, item)) updated++;
    } catch (e) {
      // Sin credenciales no hay nada que sincronizar: que se vea en el log del
      // worker (antes se tragaba y el sync quedaba muerto en silencio).
      if (e instanceof Error && /no está configurado/i.test(e.message)) throw e;
      // item borrado/inaccesible: se ignora
    }
  }
  return { total: publications.length, updated };
}
