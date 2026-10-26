import { prisma } from "@/lib/prisma/client";
import { mlFetch } from "./client";
import type { MlItem } from "./items";

/**
 * Vigilancia de avisos de MercadoLibre: detecta cuando un aviso nuestro se
 * cierra o pausa SIN que el sistema lo haya pedido.
 *
 * Caso real (Alvear al 900, 26/10/2026): se publicó y a los 3 minutos quedó
 * cerrado. No fue ML (sin infracción) ni el sistema: fue Tokko, conectado a la
 * misma cuenta, que cerró otro aviso suyo con el mismo título y se llevó puesto
 * el nuestro. Nadie se enteró hasta que lo vio el cliente.
 *
 * Regla: cada cambio de estado que pide el sistema se guarda en la DB ANTES de
 * llamar a ML. Entonces, si ML informa un estado distinto al guardado y el
 * guardado era activo/pausado, el cambio vino de afuera → se marca la alerta.
 */

/** Estados nuestros desde los que una baja no pedida es noticia
 * (not_yet_active: recién publicado, ML todavía lo está procesando). */
const WATCHED = new Set(["active", "paused", "not_yet_active"]);

/** sub_status de ML que indican moderación (los demás, ej. pack_quota_assigned, no dicen nada). */
const MODERATION_SUB = new Set(["forbidden", "held", "suspended", "waiting_for_patch", "freezed", "under_review"]);

interface MlInfraction {
  reason?: string;
  remedy?: string;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function verbFor(status: string): string {
  if (status === "closed") return "cerró";
  if (status === "paused") return "pausó";
  return `pasó a "${status}"`;
}

/** Explica en castellano quién y por qué cambió el aviso. */
export async function describeExternalChange(item: MlItem): Promise<string> {
  const verb = verbFor(item.status);
  const sellerId = (item as { seller_id?: number }).seller_id;
  if (sellerId) {
    try {
      const res = await mlFetch<{ infractions: MlInfraction[] | null }>(`/moderations/infractions/${sellerId}`, {
        query: { related_item_id: item.id },
      });
      const inf = res.infractions?.[0];
      if (inf?.reason) {
        const remedy = inf.remedy ? ` ${stripHtml(inf.remedy)}` : "";
        return `MercadoLibre lo ${verb}: ${inf.reason}.${remedy}`.replace(/\.\./g, ".");
      }
    } catch {
      /* sin datos de moderación: seguimos con lo que hay */
    }
  }
  const sub = Array.isArray(item.sub_status) ? (item.sub_status as string[]) : [];
  const moderation = sub.filter((s) => MODERATION_SUB.has(s));
  if (moderation.length) return `MercadoLibre lo ${verb} por moderación (${moderation.join(", ")}). Revisalo en MercadoLibre.`;
  return `Se ${verb} desde fuera del sistema y MercadoLibre no informa sanción: lo hizo otra herramienta conectada a la cuenta (ej. Tokko) o alguien desde MercadoLibre.`;
}

type WatchedPublication = { id: string; status: string; permalink: string | null };

/**
 * Aplica a la DB el estado real del item de ML. Lo usan el webhook, el sync del
 * worker y la pantalla del aviso. Devuelve la fila actualizada (o null si no
 * cambió nada).
 */
export async function reconcileMlPublication(pub: WatchedPublication, item: MlItem) {
  const status = item.status || pub.status;
  const permalink = item.permalink || pub.permalink;
  if (status === pub.status && permalink === pub.permalink) return null;

  const external = WATCHED.has(pub.status) && status !== pub.status && status !== "active";
  const extra = external ? { externalChangeAt: new Date(), externalChangeDetail: await describeExternalChange(item) } : {};
  if (external) console.warn(`[ML] aviso ${item.id} ${pub.status} → ${status} sin pedido del sistema: ${extra.externalChangeDetail}`);

  return prisma.propertyPublication.update({
    where: { id: pub.id },
    data: { status, permalink, ...extra },
  });
}
