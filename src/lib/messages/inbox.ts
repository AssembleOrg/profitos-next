/**
 * Central de mensajes: unifica los "contactos/mensajes" de los distintos
 * portales en una sola lista de últimos contactos.
 *
 * Fuentes:
 *  - ScrapedLead (jp_scraped_leads): ZonaProp / ArgenProp — leads scrapeados con
 *    datos de contacto (nombre, tel, email, mensaje, propiedad).
 *  - PortalQuestion (jp_portal_questions): MercadoLibre — preguntas públicas del
 *    aviso (texto + estado; sin datos de contacto, ML no los expone).
 *
 * Ambas se normalizan a `InboxMessage` y se ordenan por fecha desc. La
 * paginación se hace en memoria sobre la unión (los volúmenes son chicos).
 */
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";

export const INBOX_PORTALS = ["mercadolibre", "zonaprop", "argenprop"] as const;
export type InboxPortal = (typeof INBOX_PORTALS)[number];
const SCRAPER_PORTALS = ["zonaprop", "argenprop"] as const;

export type InboxMessage = {
  id: string; // `${portal}:${rowId}` — único entre fuentes
  portal: InboxPortal;
  kind: string; // sección scrapeada (mensajes/telefono/whatsapp/contactados) o "pregunta"
  date: string | null; // ISO
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  answered: boolean | null; // ML: respondida; scrapeados: null (no aplica)
  answerText: string | null;
  propertyTitle: string | null;
  propertyRef: string | null;
  propertyUrl: string | null;
  price: string | null;
};

export type InboxFilters = {
  portal?: string; // "" | InboxPortal
  q?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  page?: number;
  limit?: number;
};

export type InboxResult = {
  items: InboxMessage[];
  total: number;
  totalAll: number;
  counts: Record<InboxPortal, number>; // por portal, con filtros q/fecha (sin filtro de portal)
};

function isInboxPortal(v: string | undefined): v is InboxPortal {
  return !!v && (INBOX_PORTALS as readonly string[]).includes(v);
}

function dateBounds(from?: string, to?: string): { gte?: Date; lte?: Date } {
  const b: { gte?: Date; lte?: Date } = {};
  if (from) b.gte = new Date(`${from}T00:00:00`);
  if (to) b.lte = new Date(`${to}T23:59:59`);
  return b;
}

function scrapedWhere(q: string, bounds: { gte?: Date; lte?: Date }): Prisma.ScrapedLeadWhereInput {
  const and: Prisma.ScrapedLeadWhereInput[] = [{ portal: { in: [...SCRAPER_PORTALS] } }];
  if (q) {
    and.push({
      OR: [
        { contactName: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
        { contactPhone: { contains: q, mode: "insensitive" } },
        { messageText: { contains: q, mode: "insensitive" } },
        { propertyTitle: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (bounds.gte || bounds.lte) and.push({ messageAt: bounds });
  return { AND: and };
}

function questionWhere(q: string, bounds: { gte?: Date; lte?: Date }): Prisma.PortalQuestionWhereInput {
  const and: Prisma.PortalQuestionWhereInput[] = [{ portal: "mercadolibre" }];
  if (q) and.push({ text: { contains: q, mode: "insensitive" } });
  if (bounds.gte || bounds.lte) and.push({ askedAt: bounds });
  return { AND: and };
}

function mapScraped(row: {
  id: string;
  portal: string;
  section: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  messageText: string | null;
  messageAt: Date | null;
  scrapedAt: Date;
  propertyTitle: string | null;
  propertyRef: string | null;
  propertyUrl: string | null;
  price: string | null;
}): InboxMessage {
  const date = row.messageAt ?? row.scrapedAt;
  return {
    id: `${row.portal}:${row.id}`,
    portal: row.portal as InboxPortal,
    kind: row.section,
    date: date ? date.toISOString() : null,
    name: row.contactName,
    email: row.contactEmail,
    phone: row.contactPhone,
    message: row.messageText,
    answered: null,
    answerText: null,
    propertyTitle: row.propertyTitle,
    propertyRef: row.propertyRef,
    propertyUrl: row.propertyUrl,
    price: row.price,
  };
}

/** Devuelve la lista unificada, paginada y ordenada por fecha desc. */
export async function getInboxMessages(filters: InboxFilters): Promise<InboxResult> {
  const q = (filters.q ?? "").trim();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const bounds = dateBounds(filters.from, filters.to);
  const portalFilter = isInboxPortal(filters.portal) ? filters.portal : undefined;

  const wantScraped = !portalFilter || portalFilter !== "mercadolibre";
  const wantMl = !portalFilter || portalFilter === "mercadolibre";
  // Cada fuente ordenada desc: alcanza con traer page*limit para poder cortar la unión.
  const fetchTake = page * limit;

  const sw = scrapedWhere(q, bounds);
  const qw = questionWhere(q, bounds);

  const [scrapedRows, mlRows, zpCount, apCount, mlCount] = await Promise.all([
    wantScraped
      ? prisma.scrapedLead.findMany({
          where: portalFilter ? { AND: [sw, { portal: portalFilter }] } : sw,
          orderBy: [{ messageAt: "desc" }, { scrapedAt: "desc" }],
          take: fetchTake,
        })
      : Promise.resolve([]),
    wantMl
      ? prisma.portalQuestion.findMany({
          where: qw,
          orderBy: [{ askedAt: "desc" }, { createdAt: "desc" }],
          take: fetchTake,
        })
      : Promise.resolve([]),
    prisma.scrapedLead.count({ where: { AND: [sw, { portal: "zonaprop" }] } }),
    prisma.scrapedLead.count({ where: { AND: [sw, { portal: "argenprop" }] } }),
    prisma.portalQuestion.count({ where: qw }),
  ]);

  // ML: resolver dirección/permalink de la propiedad (sin FK, lookup por id).
  const propertyIds = [...new Set(mlRows.map((x) => x.propertyId).filter(Boolean))] as string[];
  const properties = propertyIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, address: true, publicUrl: true },
      })
    : [];
  const propMap = new Map(properties.map((p) => [p.id, p]));

  const mlMapped: InboxMessage[] = mlRows.map((x) => {
    const prop = x.propertyId ? propMap.get(x.propertyId) : undefined;
    const date = x.askedAt ?? x.createdAt;
    return {
      id: `mercadolibre:${x.id}`,
      portal: "mercadolibre",
      kind: "pregunta",
      date: date ? date.toISOString() : null,
      name: null,
      email: null,
      phone: null,
      message: x.text,
      answered: x.status === "ANSWERED",
      answerText: x.answerText,
      propertyTitle: prop?.address ?? null,
      propertyRef: x.itemId,
      propertyUrl: prop?.publicUrl ?? null,
      price: null,
    };
  });

  const merged = [...scrapedRows.map(mapScraped), ...mlMapped].sort((a, b) => {
    const ta = a.date ? Date.parse(a.date) : 0;
    const tb = b.date ? Date.parse(b.date) : 0;
    return tb - ta;
  });

  const counts: Record<InboxPortal, number> = {
    mercadolibre: mlCount,
    zonaprop: zpCount,
    argenprop: apCount,
  };
  const total = portalFilter ? counts[portalFilter] : counts.mercadolibre + counts.zonaprop + counts.argenprop;
  const items = merged.slice((page - 1) * limit, page * limit);

  return { items, total, totalAll: counts.mercadolibre + counts.zonaprop + counts.argenprop, counts };
}
