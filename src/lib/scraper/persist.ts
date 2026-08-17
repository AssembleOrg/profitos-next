import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import type { Portal } from "./session";

/** Convierte a valor JSON de Prisma, usando NULL de DB cuando es null/undefined. */
function json(v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

export type LeadRow = {
  portal: Portal;
  section: string;
  externalId: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  messageText?: string | null;
  messageAt?: Date | null;
  propertyRef?: string | null;
  propertyTitle?: string | null;
  propertyAddress?: string | null;
  propertyUrl?: string | null;
  price?: string | null;
  mapPolygon?: unknown;
  raw?: unknown;
};

/** Devuelve los external_id ya guardados de esa sección (para dedup). */
export async function existingExternalIds(
  portal: Portal,
  section: string,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.scrapedLead.findMany({
    where: { portal, section, externalId: { in: ids } },
    select: { externalId: true },
  });
  return new Set(rows.map((r) => r.externalId));
}

/** Inserta los leads nuevos (ignora duplicados por el índice único). */
export async function saveLeads(rows: LeadRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const res = await prisma.scrapedLead.createMany({
    data: rows.map((r) => ({
      portal: r.portal,
      section: r.section,
      externalId: r.externalId,
      contactName: r.contactName ?? null,
      contactEmail: r.contactEmail ?? null,
      contactPhone: r.contactPhone ?? null,
      messageText: r.messageText ?? null,
      messageAt: r.messageAt ?? null,
      propertyRef: r.propertyRef ?? null,
      propertyTitle: r.propertyTitle ?? null,
      propertyAddress: r.propertyAddress ?? null,
      propertyUrl: r.propertyUrl ?? null,
      price: r.price ?? null,
      mapPolygon: json(r.mapPolygon),
      raw: json(r.raw),
    })),
    skipDuplicates: true,
  });
  return res.count;
}
