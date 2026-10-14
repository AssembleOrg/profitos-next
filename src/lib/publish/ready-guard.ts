import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";
import { publishReadiness, faltanTexto, type ReadinessPortal } from "./readiness";

/** Campos que mira la validación de "listo para publicar". */
export const READINESS_SELECT = {
  type: true,
  operationType: true,
  operationPrice: true,
  operationCurrency: true,
  publicationTitle: true,
  address: true,
  description: true,
  province: true,
  city: true,
  geoLat: true,
  geoLong: true,
  photos: true,
  coverImageUrl: true,
} as const;

/**
 * Guard server-side: la web bloquea el botón con el checklist, pero cualquier
 * llamada directa a la API (o un cliente viejo) también tiene que frenarse acá.
 * Lanza 409 con lo que falta.
 */
export async function assertReadyToPublish(propertyId: string, portals: ReadinessPortal[]): Promise<void> {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: READINESS_SELECT });
  if (!property) throw new AppError(404, "Propiedad no encontrada");
  for (const portal of portals) {
    const r = publishReadiness(property, portal);
    if (!r.ok) throw new AppError(409, `No se puede publicar en ${portal}: falta completar ${faltanTexto(r)}.`);
  }
}
