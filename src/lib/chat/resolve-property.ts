import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";

export type PropertyRef = { id: string; direccion: string; codigo: string | null; operacion: string | null; estado: string };

const SELECT = {
  id: true,
  address: true,
  realAddress: true,
  referenceCode: true,
  operationType: true,
  status: true,
} as const;

function toRef(p: { id: string; address: string; realAddress: string | null; referenceCode: string | null; operationType: string | null; status: string }): PropertyRef {
  return { id: p.id, direccion: p.realAddress ?? p.address, codigo: p.referenceCode, operacion: p.operationType, estado: p.status };
}

/**
 * Identifica UNA propiedad para las tools de acción del chat. Acepta id
 * interno, código de referencia (exacto, sin importar mayúsculas) o dirección
 * (búsqueda parcial). Si hay varias candidatas tira 409 con la lista, para que
 * el bot le pregunte al usuario cuál es antes de actuar.
 */
export async function resolveProperty(input: { propertyId?: string; referencia?: string; direccion?: string }): Promise<PropertyRef> {
  const id = input.propertyId?.trim();
  if (id) {
    const p = await prisma.property.findUnique({ where: { id }, select: SELECT });
    if (!p) throw new AppError(404, `No existe una propiedad con id ${id}`);
    return toRef(p);
  }

  const ref = input.referencia?.trim();
  if (ref) {
    const rows = await prisma.property.findMany({
      where: { referenceCode: { equals: ref, mode: "insensitive" } },
      select: SELECT,
      take: 5,
    });
    if (rows.length === 1) return toRef(rows[0]);
    if (rows.length > 1) throw ambiguous(rows.map(toRef));
    // Sin match exacto: probar como dirección (el usuario puede confundir ambos).
  }

  const dir = (input.direccion ?? ref ?? "").trim();
  if (!dir) throw new AppError(400, "Indicá la propiedad por código de referencia o dirección");
  // Por palabras (todas deben aparecer): tolera dobles espacios, "3º" vs "3",
  // y orden distinto ("piso 3 uriburu 1734"). Se ignoran conectores cortos.
  const words = dir
    .toLowerCase()
    .replace(/[º°]/g, "")
    .split(/[\s,.-]+/)
    .filter((w) => w.length > 1 && !["de", "del", "la", "el", "al", "y"].includes(w));
  const rows = await prisma.property.findMany({
    where: {
      OR: [
        { referenceCode: { contains: dir, mode: "insensitive" } },
        {
          AND: words.map((w) => ({
            OR: [
              { address: { contains: w, mode: "insensitive" as const } },
              { realAddress: { contains: w, mode: "insensitive" as const } },
            ],
          })),
        },
      ],
    },
    select: SELECT,
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  if (!rows.length) throw new AppError(404, `No encontré ninguna propiedad que coincida con "${dir}"`);
  if (rows.length > 1) throw ambiguous(rows.map(toRef));
  return toRef(rows[0]);
}

function ambiguous(candidatas: PropertyRef[]): AppError {
  const lista = candidatas.map((c) => `${c.direccion}${c.codigo ? ` (ref ${c.codigo})` : ""} [id ${c.id}]`).join("; ");
  return new AppError(409, `Hay ${candidatas.length} propiedades que coinciden; preguntale al usuario cuál y reintentá con propertyId. Candidatas: ${lista}`);
}
