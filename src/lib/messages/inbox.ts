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
  /** Propiedad NUESTRA resuelta (por referenceCode o id): habilita el
   *  deep-link /propiedades?open=<id>. Null si el aviso no es de Profitos. */
  propertyId: string | null;
  propertyAddress: string | null;
  coverImageUrl: string | null;
  /** Estado de gestión (jp_contact_cases). Null = nuevo/propuesto. */
  caseStatus: "tomado" | "espera" | "descartado" | null;
  takenByUserId: string | null;
  takenByName: string | null;
};

export type InboxFilters = {
  portal?: string; // "" | InboxPortal
  q?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  page?: number;
  limit?: number;
  /** Estado de gestión: nuevos (default) | espera | tomados | descartados | todos */
  estado?: string;
  /** true = sólo contactos "míos": propiedades donde soy responsable interno,
   *  sin responsables/propiedad (nadie los cubre), o tomados por mí. */
  mine?: boolean;
};

export type InboxViewer = { userId: string; isAdmin: boolean };

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
}, prop?: { id: string; address: string; coverImageUrl?: string | null } | null): InboxMessage {
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
    propertyId: prop?.id ?? null,
    propertyAddress: prop?.address ?? null,
    coverImageUrl: prop?.coverImageUrl ?? null,
    caseStatus: null,
    takenByUserId: null,
    takenByName: null,
  };
}

/**
 * Mapa referenceCode → propiedad para vincular leads scrapeados con nuestras
 * propiedades (el propertyRef del lead es el código interno del aviso, que en
 * los avisos de Profitos coincide con Property.referenceCode).
 */
export async function resolveLeadProperties(
  refs: (string | null)[]
): Promise<Map<string, { id: string; address: string; coverImageUrl: string | null }>> {
  const clean = [...new Set(refs.filter((r): r is string => Boolean(r)))];
  if (!clean.length) return new Map();
  const props = await prisma.property.findMany({
    where: { referenceCode: { in: clean } },
    select: { id: true, address: true, referenceCode: true, coverImageUrl: true },
  });
  return new Map(props.map((p) => [p.referenceCode!, { id: p.id, address: p.address, coverImageUrl: p.coverImageUrl }]));
}

/**
 * Un mensaje puntual por id (`portal:rowId`), con su estado de gestión. Se usa
 * para abrir la central directo sobre una tarjeta (deep-link desde una
 * notificación), sin depender de filtros ni paginado. Null si no existe.
 */
export async function getInboxMessageById(id: string): Promise<InboxMessage | null> {
  const sep = id.indexOf(":");
  if (sep <= 0) return null;
  const portal = id.slice(0, sep);
  const rowId = id.slice(sep + 1);
  if (!isInboxPortal(portal) || !rowId) return null;

  let msg: InboxMessage | null = null;
  if (portal === "mercadolibre") {
    const x = await prisma.portalQuestion.findUnique({ where: { id: rowId } });
    if (!x) return null;
    const prop = x.propertyId
      ? await prisma.property.findUnique({
          where: { id: x.propertyId },
          select: { id: true, address: true, publicUrl: true, coverImageUrl: true },
        })
      : null;
    const date = x.askedAt ?? x.createdAt;
    msg = {
      id,
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
      propertyId: prop?.id ?? null,
      propertyAddress: prop?.address ?? null,
      coverImageUrl: prop?.coverImageUrl ?? null,
      caseStatus: null,
      takenByUserId: null,
      takenByName: null,
    };
  } else {
    const r = await prisma.scrapedLead.findUnique({ where: { id: rowId } });
    if (!r || r.portal !== portal) return null;
    const leadPropMap = await resolveLeadProperties([r.propertyRef]);
    msg = mapScraped(r, r.propertyRef ? leadPropMap.get(r.propertyRef) : null);
  }

  const c = await prisma.contactCase.findUnique({
    where: { id },
    select: { status: true, takenByUserId: true, takenByUser: { select: { fullName: true, email: true } } },
  });
  if (c) {
    msg.caseStatus = c.status as InboxMessage["caseStatus"];
    msg.takenByUserId = c.takenByUserId;
    msg.takenByName = c.takenByUser?.fullName?.trim() || c.takenByUser?.email || null;
  }
  return msg;
}

// Ventana de trabajo en memoria: el filtrado por estado/responsable se hace
// post-DB, así que traemos una ventana grande de cada fuente (volúmenes chicos).
const FETCH_WINDOW = 600;
// Un contacto "en espera" que nadie toma en 3 días pasa solo a "descartado".
const WAIT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** Devuelve la lista unificada, paginada y ordenada por fecha desc. */
export async function getInboxMessages(filters: InboxFilters, viewer?: InboxViewer): Promise<InboxResult> {
  const q = (filters.q ?? "").trim();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const bounds = dateBounds(filters.from, filters.to);
  const portalFilter = isInboxPortal(filters.portal) ? filters.portal : undefined;

  // Auto-descarte perezoso: espera vencida → descartado (sin cron).
  await prisma.contactCase
    .updateMany({
      where: { status: "espera", waitingAt: { lt: new Date(Date.now() - WAIT_TTL_MS) } },
      data: { status: "descartado" },
    })
    .catch(() => {});

  const wantScraped = !portalFilter || portalFilter !== "mercadolibre";
  const wantMl = !portalFilter || portalFilter === "mercadolibre";
  const fetchTake = FETCH_WINDOW;

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
        select: { id: true, address: true, publicUrl: true, coverImageUrl: true },
      })
    : [];
  const propMap = new Map(properties.map((p) => [p.id, p]));
  // Leads scrapeados: vincular con la propiedad nuestra vía referenceCode.
  const leadPropMap = await resolveLeadProperties(scrapedRows.map((r) => r.propertyRef));

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
      propertyId: prop?.id ?? null,
      propertyAddress: prop?.address ?? null,
      coverImageUrl: prop?.coverImageUrl ?? null,
      caseStatus: null,
      takenByUserId: null,
      takenByName: null,
    };
  });

  let merged = [
    ...scrapedRows.map((r) => mapScraped(r, r.propertyRef ? leadPropMap.get(r.propertyRef) : null)),
    ...mlMapped,
  ].sort((a, b) => {
    const ta = a.date ? Date.parse(a.date) : 0;
    const tb = b.date ? Date.parse(b.date) : 0;
    return tb - ta;
  });

  // Estado de gestión (jp_contact_cases) de la ventana.
  const cases = merged.length
    ? await prisma.contactCase.findMany({
        where: { id: { in: merged.map((m) => m.id) } },
        select: { id: true, status: true, takenByUserId: true, takenByUser: { select: { fullName: true, email: true } } },
      })
    : [];
  const caseMap = new Map(cases.map((c) => [c.id, c]));
  for (const m of merged) {
    const c = caseMap.get(m.id);
    if (!c) continue;
    m.caseStatus = c.status as InboxMessage["caseStatus"];
    m.takenByUserId = c.takenByUserId;
    m.takenByName = c.takenByUser?.fullName?.trim() || c.takenByUser?.email || null;
  }

  // Filtro por estado de gestión. Default: "nuevos" (sin caso = propuestos).
  const estado = (filters.estado ?? "nuevos").trim();
  if (estado !== "todos") {
    merged = merged.filter((m) => {
      if (estado === "nuevos") return m.caseStatus === null;
      if (estado === "espera") return m.caseStatus === "espera";
      if (estado === "tomados") return m.caseStatus === "tomado";
      if (estado === "descartados") return m.caseStatus === "descartado";
      return true;
    });
  }

  // Filtro "míos": propiedades donde soy responsable interno, contactos sin
  // responsable que los cubra (para que no queden huérfanos) o tomados por mí.
  if (filters.mine && viewer) {
    const propIds = [...new Set(merged.map((m) => m.propertyId).filter(Boolean))] as string[];
    const respRows = propIds.length
      ? await prisma.propertyResponsible.findMany({
          where: { propertyId: { in: propIds } },
          select: { propertyId: true, userId: true },
        })
      : [];
    const respByProp = new Map<string, Set<string>>();
    for (const r of respRows) {
      const set = respByProp.get(r.propertyId) ?? new Set<string>();
      set.add(r.userId);
      respByProp.set(r.propertyId, set);
    }
    merged = merged.filter((m) => {
      if (m.takenByUserId === viewer.userId) return true;
      if (!m.propertyId) return true; // sin propiedad → nadie lo cubre, se muestra
      const set = respByProp.get(m.propertyId);
      if (!set || set.size === 0) return true; // sin responsables → se muestra
      return set.has(viewer.userId);
    });
  }

  // Los counts por portal reflejan la vista filtrada (chips de la UI).
  const counts: Record<InboxPortal, number> = { mercadolibre: 0, zonaprop: 0, argenprop: 0 };
  for (const m of merged) counts[m.portal]++;
  const total = merged.length;
  const items = merged.slice((page - 1) * limit, page * limit);

  return { items, total, totalAll: zpCount + apCount + mlCount, counts };
}
