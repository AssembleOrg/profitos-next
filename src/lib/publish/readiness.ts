/**
 * Validación de "listo para publicar": qué campos mínimos necesita una propiedad
 * para publicarse en cada portal SIN que el portal falle. Función pura (sin
 * prisma) para poder usarla en el server (rutas, chat) y en el cliente (modal
 * de la propiedad).
 *
 * Motivación: antes se podía guardar una propiedad incompleta y al publicar el
 * portal fallaba con un error crudo (ej. ArgenProp: "no encontré la provincia").
 * Ahora la web bloquea el botón con un checklist y el chat pregunta lo que falta.
 */

export type ReadinessPortal = "zonaprop" | "argenprop" | "mercadolibre";

/** Subconjunto de Property que mira la validación (nombres del modelo Prisma). */
export type ReadinessInput = {
  type?: string | null;
  operationType?: string | null;
  operationPrice?: number | null;
  operationCurrency?: string | null;
  publicationTitle?: string | null;
  address?: string | null;
  province?: string | null;
  city?: string | null;
  geoLat?: number | null;
  geoLong?: number | null;
  /** Cantidad de fotos (calculada por quien llama, o el JSON crudo). */
  photosCount?: number | null;
  photos?: unknown;
  coverImageUrl?: string | null;
};

export type MissingField = { campo: string; label: string };
export type PortalReadiness = { portal: ReadinessPortal; ok: boolean; faltan: MissingField[]; recomendado: MissingField[] };

const F = {
  type: { campo: "type", label: "Tipo de propiedad" },
  operationType: { campo: "operationType", label: "Operación (venta/alquiler)" },
  price: { campo: "operationPrice", label: "Precio" },
  currency: { campo: "operationCurrency", label: "Moneda" },
  title: { campo: "publicationTitle", label: "Título o dirección" },
  photos: { campo: "photos", label: "Al menos una foto" },
  province: { campo: "province", label: "Provincia" },
  city: { campo: "city", label: "Localidad / ciudad" },
  geo: { campo: "geo", label: "Coordenadas (para ubicar el aviso en el mapa)" },
} as const;

function has(v: string | null | undefined): boolean {
  return Boolean(v && v.trim());
}

/** Cuenta fotos desde photosCount, o del JSON `photos` (+ coverImageUrl). */
export function countPhotos(input: ReadinessInput): number {
  if (typeof input.photosCount === "number") return input.photosCount;
  let n = 0;
  if (Array.isArray(input.photos)) {
    for (const p of input.photos) {
      if (typeof p === "string") n++;
      else if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        if (typeof (o.image ?? o.url ?? o.src) === "string") n++;
      }
    }
  }
  if (!n && has(input.coverImageUrl)) n = 1;
  return n;
}

/** Campos base que necesita cualquier portal. */
function baseMissing(p: ReadinessInput): MissingField[] {
  const m: MissingField[] = [];
  if (!has(p.type)) m.push(F.type);
  if (!has(p.operationType)) m.push(F.operationType);
  if (!(typeof p.operationPrice === "number" && p.operationPrice > 0)) m.push(F.price);
  if (!has(p.operationCurrency)) m.push(F.currency);
  if (!has(p.publicationTitle) && !has(p.address)) m.push(F.title);
  if (countPhotos(p) < 1) m.push(F.photos);
  return m;
}

/** Valida una propiedad para un portal. `faltan` bloquea; `recomendado` no. */
export function publishReadiness(p: ReadinessInput, portal: ReadinessPortal): PortalReadiness {
  const faltan = baseMissing(p);
  const recomendado: MissingField[] = [];
  const hasGeo = typeof p.geoLat === "number" && typeof p.geoLong === "number";

  if (portal === "argenprop" || portal === "mercadolibre") {
    if (!has(p.province)) faltan.push(F.province);
    if (!has(p.city)) faltan.push(F.city);
  }
  if (portal === "zonaprop") {
    // ZonaProp ubica el aviso por coordenadas; sin geo el aviso queda sin
    // ubicación en el mapa (publica, pero incompleto) → recomendado, no bloquea.
    if (!hasGeo) recomendado.push(F.geo);
  } else if (!hasGeo) {
    recomendado.push(F.geo);
  }

  return { portal, ok: faltan.length === 0, faltan, recomendado };
}

export const READINESS_PORTALS: ReadinessPortal[] = ["zonaprop", "argenprop", "mercadolibre"];

/** Valida los tres portales de una vez. */
export function publishReadinessAll(p: ReadinessInput): Record<ReadinessPortal, PortalReadiness> {
  return {
    zonaprop: publishReadiness(p, "zonaprop"),
    argenprop: publishReadiness(p, "argenprop"),
    mercadolibre: publishReadiness(p, "mercadolibre"),
  };
}

/** Texto legible de lo que falta (para el chat / mensajes de error). */
export function faltanTexto(r: PortalReadiness): string {
  return r.faltan.map((f) => f.label).join(", ");
}
