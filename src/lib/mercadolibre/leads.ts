/**
 * Interesados de MercadoLibre (VIS leads): quien toca "WhatsApp" o "Llamar" en
 * un aviso queda registrado aunque no llegue a mandar el mensaje. ML da nombre,
 * email, teléfono y el aviso (lo que hacía Tokko).
 *
 *   GET /vis/users/{sellerId}/leads/buyers?offset=&limit=  → por comprador+aviso: datos + leads[{channel, created_at}]
 *   GET /vis/leads/{leadId}                                 → un lead suelto (webhook topic "vis_leads")
 *
 * ML guarda ~2 meses; se traen los de los últimos LEADS_WINDOW_DAYS. Se guardan
 * en jp_scraped_leads (portal "mercadolibre") para que entren a la central y a
 * la campana como los de ZonaProp/ArgenProp. Un contacto = comprador + aviso +
 * canal: si vuelve a tocar, se actualiza la fecha (no se duplica).
 * Las preguntas (channel "question") no se traen: ya entran por jp_portal_questions.
 */
import { prisma } from "@/lib/prisma/client";
import { mlFetch } from "./client";
import { ML_PORTAL } from "./config";

export const LEADS_WINDOW_DAYS = 15;

/** Canal de ML → sección de la central (mismas que ZP/AP). */
const SECTION: Record<string, string> = { whatsapp: "whatsapp", call: "telefono", schedule: "visita" };

type MlLead = { id: string; channel?: string; contact_type?: string; created_at: string; item_id?: string };
type MlBuyer = {
  id: number;
  item_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  identification_number?: string | null;
  identification_type?: string | null;
  leads?: MlLead[];
};
type MlLeadDetail = MlLead & Omit<MlBuyer, "id" | "leads"> & { buyer_id: number };

export type MlLeadRow = {
  externalId: string;
  section: string;
  itemId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  doc: string | null;
  clicks: number;
  lastAt: Date;
};

/** Agrupa por comprador + aviso + canal (pura, testeable). */
export function groupBuyerLeads(buyers: MlBuyer[], since: Date): MlLeadRow[] {
  const out = new Map<string, MlLeadRow>();
  for (const b of buyers) {
    for (const l of b.leads ?? []) {
      const section = SECTION[l.channel ?? l.contact_type ?? ""];
      const at = new Date(l.created_at);
      if (!section || !(at >= since)) continue;
      const itemId = l.item_id || b.item_id;
      const key = `${b.id}:${itemId}:${section}`;
      const prev = out.get(key);
      if (prev) {
        prev.clicks++;
        if (at > prev.lastAt) prev.lastAt = at;
        continue;
      }
      out.set(key, {
        externalId: `${b.id}:${itemId}`,
        section,
        itemId,
        name: b.name?.trim() || null,
        email: b.email?.trim() || null,
        phone: b.phone?.trim() || null,
        doc: b.identification_number ? `${b.identification_type ?? "DOC"} ${b.identification_number}` : null,
        clicks: 1,
        lastAt: at,
      });
    }
  }
  return [...out.values()];
}

const VERB: Record<string, string> = { whatsapp: "Tocó WhatsApp", telefono: "Tocó Llamar", visita: "Pidió una visita" };

function messageFor(r: MlLeadRow): string {
  const veces = r.clicks > 1 ? ` (${r.clicks} veces)` : "";
  return `${VERB[r.section] ?? "Contacto"} en el aviso de MercadoLibre${veces}.${r.doc ? ` ${r.doc}.` : ""}`;
}

export type MlItemInfo = { code: string | null; permalink: string | null; title: string | null; address: string | null };

/**
 * Datos de avisos que no publicamos nosotros (los sube Tokko): el atributo
 * PROPERTY_CODE trae el código de Tokko = Property.referenceCode.
 */
export async function fetchMlItemsInfo(itemIds: string[]): Promise<Map<string, MlItemInfo>> {
  const out = new Map<string, MlItemInfo>();
  for (let i = 0; i < itemIds.length; i += 20) {
    const ids = itemIds.slice(i, i + 20);
    const res = await mlFetch<{ code: number; body?: { id: string; title?: string; permalink?: string; attributes?: { id: string; value_name?: string | null }[]; location?: { address_line?: string } } }[]>(
      "/items",
      { query: { ids: ids.join(","), attributes: "id,title,permalink,attributes,location" } },
    ).catch(() => []);
    for (const r of res) {
      if (r.code !== 200 || !r.body) continue;
      const b = r.body;
      out.set(b.id, {
        code: b.attributes?.find((a) => a.id === "PROPERTY_CODE")?.value_name?.trim() || null,
        permalink: b.permalink ?? null,
        title: b.title ?? null,
        address: b.location?.address_line?.replace(/\s+/g, " ").trim() || null,
      });
    }
  }
  return out;
}

/**
 * Guarda/actualiza los contactos. `itemsInfo`: datos de los avisos que no están
 * en jp_property_publications (si no se pasa, se piden a ML).
 */
export async function saveMlLeads(rows: MlLeadRow[], itemsInfo?: Map<string, MlItemInfo>): Promise<{ created: number; updated: number }> {
  if (!rows.length) return { created: 0, updated: 0 };
  const items = [...new Set(rows.map((r) => r.itemId))];
  const pubs = await prisma.propertyPublication.findMany({
    where: { portal: ML_PORTAL, externalId: { in: items } },
    select: { externalId: true, permalink: true, property: { select: { address: true, referenceCode: true, publicationTitle: true } } },
  });
  const byItem = new Map(pubs.map((p) => [p.externalId!, p]));
  const unknown = items.filter((id) => !byItem.has(id));
  const info = itemsInfo ?? (unknown.length ? await fetchMlItemsInfo(unknown) : new Map<string, MlItemInfo>());
  const codes = [...new Set(unknown.map((id) => info.get(id)?.code).filter((c): c is string => !!c))];
  const byCode = new Map(
    (codes.length
      ? await prisma.property.findMany({ where: { referenceCode: { in: codes } }, select: { address: true, referenceCode: true, publicationTitle: true } })
      : []
    ).map((p) => [p.referenceCode!, p]),
  );

  const existing = await prisma.scrapedLead.findMany({
    where: { portal: ML_PORTAL, externalId: { in: rows.map((r) => r.externalId) } },
    select: { id: true, section: true, externalId: true, messageAt: true, raw: true },
  });
  const byKey = new Map(existing.map((e) => [`${e.externalId}:${e.section}`, e]));

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const pub = byItem.get(r.itemId);
    const it = info.get(r.itemId);
    const prop = pub?.property ?? (it?.code ? byCode.get(it.code) : undefined);
    const data = {
      contactName: r.name,
      contactEmail: r.email,
      contactPhone: r.phone,
      messageText: messageFor(r),
      messageAt: r.lastAt,
      // La central vincula la propiedad por referenceCode; sin propiedad queda el MLA.
      propertyRef: prop?.referenceCode ?? it?.code ?? r.itemId,
      propertyTitle: prop?.publicationTitle ?? it?.title ?? prop?.address ?? r.itemId,
      propertyAddress: prop?.address ?? it?.address ?? null,
      propertyUrl: pub?.permalink ?? it?.permalink ?? null,
      raw: { itemId: r.itemId, clicks: r.clicks } as object,
    };
    const prev = byKey.get(`${r.externalId}:${r.section}`);
    if (!prev) {
      await prisma.scrapedLead.create({ data: { portal: ML_PORTAL, section: r.section, externalId: r.externalId, ...data } });
      created++;
    } else if ((prev.messageAt?.getTime() ?? 0) !== r.lastAt.getTime() || (prev.raw as { clicks?: number } | null)?.clicks !== r.clicks) {
      await prisma.scrapedLead.update({ where: { id: prev.id }, data });
      updated++;
    }
  }
  return { created, updated };
}

const PAGE = 100;
const MAX_PAGES = 20;

/** Trae los interesados de los últimos LEADS_WINDOW_DAYS y los guarda. */
export async function syncMlLeads(): Promise<{ buyers: number; contacts: number; created: number; updated: number }> {
  const me = await mlFetch<{ id: number }>("/users/me");
  const since = new Date(Date.now() - LEADS_WINDOW_DAYS * 24 * 60 * 60_000);
  const buyers: MlBuyer[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await mlFetch<{ results?: MlBuyer[]; paging?: { total?: number } }>(`/vis/users/${me.id}/leads/buyers`, {
      query: { offset: page * PAGE, limit: PAGE },
    });
    const batch = res.results ?? [];
    buyers.push(...batch);
    // Vienen del más reciente al más viejo: cuando una página entera es anterior a la ventana, cortamos.
    const newest = batch.flatMap((b) => (b.leads ?? []).map((l) => Date.parse(l.created_at))).reduce((a, b) => Math.max(a, b), 0);
    if (batch.length < PAGE || (page + 1) * PAGE >= (res.paging?.total ?? 0) || newest < since.getTime()) break;
  }
  const rows = groupBuyerLeads(buyers, since);
  const saved = await saveMlLeads(rows);
  return { buyers: buyers.length, contacts: rows.length, ...saved };
}

/** Webhook "vis_leads": un lead suelto. */
export async function handleMlLeadNotification(leadId: string): Promise<void> {
  const d = await mlFetch<MlLeadDetail>(`/vis/leads/${encodeURIComponent(leadId)}`);
  const since = new Date(Date.now() - LEADS_WINDOW_DAYS * 24 * 60 * 60_000);
  const rows = groupBuyerLeads([{ ...d, id: d.buyer_id, leads: [{ id: d.id, channel: d.contact_type, created_at: d.created_at, item_id: d.item_id }] }], since);
  // Un lead suelto no sabe cuántas veces tocó: se suma al contador guardado.
  const fresh: MlLeadRow[] = [];
  for (const r of rows) {
    const prev = await prisma.scrapedLead.findUnique({
      where: { portal_section_externalId: { portal: ML_PORTAL, section: r.section, externalId: r.externalId } },
      select: { messageAt: true, raw: true },
    });
    if (prev?.messageAt && prev.messageAt.getTime() >= r.lastAt.getTime()) continue; // ya contado
    r.clicks = ((prev?.raw as { clicks?: number } | null)?.clicks ?? 0) + 1;
    fresh.push(r);
  }
  await saveMlLeads(fresh);
}
