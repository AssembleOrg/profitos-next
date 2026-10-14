import { prisma } from "@/lib/prisma/client";
import { getItem } from "@/lib/mercadolibre/items";
import { changePublicationState } from "./state";

/** Estados de la propiedad que la sacan de oferta: sus avisos se dan de baja. */
export const OFF_MARKET_STATUSES = ["suspendida", "alquilada", "vendida"] as const;

export function isOffMarket(status: string | null | undefined): boolean {
  return (OFF_MARKET_STATUSES as readonly string[]).includes((status ?? "").toLowerCase());
}

export type ListingCloseResult = { portal: string; ok: boolean; message: string };

/**
 * Da de baja todos los avisos vivos (activos o pausados) de una propiedad.
 *
 * Antes, pasar una propiedad a suspendida/alquilada/vendida sólo cambiaba el
 * estado interno y los avisos seguían publicados (caso Olavarría 384 7°A,
 * oct 2026). ZonaProp y ArgenProp se encolan al worker; MercadoLibre es
 * directo. Si en ML el aviso ya estaba cerrado (p. ej. lo bajó Tokko), sólo se
 * corrige el estado guardado. Un portal que falla no frena a los demás.
 */
export async function closeActiveListings(propertyId: string): Promise<ListingCloseResult[]> {
  const pubs = await prisma.propertyPublication.findMany({
    where: { propertyId, externalId: { not: null }, status: { in: ["active", "paused"] } },
    select: { portal: true, externalId: true },
  });

  const results: ListingCloseResult[] = [];
  for (const pub of pubs) {
    try {
      if (pub.portal === "mercadolibre") {
        const item = await getItem(pub.externalId!).catch(() => null);
        if (item?.status === "closed") {
          await prisma.propertyPublication.update({
            where: { propertyId_portal: { propertyId, portal: pub.portal } },
            data: { status: "closed", lastError: null },
          });
          results.push({ portal: pub.portal, ok: true, message: "ya estaba cerrado en MercadoLibre" });
          continue;
        }
      }
      const { message } = await changePublicationState(propertyId, pub.portal, "close");
      results.push({ portal: pub.portal, ok: true, message });
    } catch (e) {
      results.push({ portal: pub.portal, ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

const PORTAL_LABEL: Record<string, string> = { zonaprop: "ZonaProp", argenprop: "ArgenProp", mercadolibre: "MercadoLibre" };

/** Resumen legible para el toast / la respuesta del chat. */
export function closeSummary(results: ListingCloseResult[], fromTokko: boolean): string {
  const parts: string[] = [];
  const ok = results.filter((r) => r.ok).map((r) => PORTAL_LABEL[r.portal] ?? r.portal);
  const failed = results.filter((r) => !r.ok);
  if (ok.length) parts.push(`Avisos dados de baja: ${ok.join(", ")}.`);
  for (const f of failed) parts.push(`No se pudo bajar ${PORTAL_LABEL[f.portal] ?? f.portal}: ${f.message}`);
  if (fromTokko) parts.push("La propiedad viene de Tokko: bajala también en Tokko para que salga de la web.");
  return parts.join(" ");
}
