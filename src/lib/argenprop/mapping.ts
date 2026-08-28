/**
 * Mapeo de una Property (nuestra DB) al input de ficha de ArgenProp.
 * Resuelve tipos, operación, moneda, precio, características y ubicación.
 */
import type { FichaInput } from "./publish";
import { resolveLocation, normalize } from "./location";

/** Campos de Property que usamos (estructural, para no acoplar a Prisma). */
export type PropertyLike = {
  type?: string | null;
  operationType?: string | null;
  operationPrice?: number | null;
  operationCurrency?: string | null;
  province?: string | null;
  city?: string | null;
  zone?: string | null;
  address?: string | null;
  publicationTitle?: string | null;
  description?: string | null;
  richDescription?: string | null;
  roomAmount?: number | null;
  bedrooms?: number | null;
  bathroomAmount?: number | null;
  parkingLotAmount?: number | null;
  floorsAmount?: number | null;
  totalSurface?: number | null;
  roofedSurface?: number | null;
  surface?: number | null;
  age?: number | null;
};

const TIPO: Record<string, string> = {
  casa: "CASA",
  departamento: "DEPARTAMENTO",
  depto: "DEPARTAMENTO",
  ph: "PH",
  terreno: "TERRENO",
  lote: "TERRENO",
  local: "LOCAL",
  "local comercial": "LOCAL",
  oficina: "OFICINA",
  galpon: "GALPON",
  deposito: "DEPOSITO",
  cochera: "GARAGE",
  garage: "GARAGE",
  quinta: "CASA_QUINTA",
  campo: "CAMPO",
};

function tipoPropiedad(t?: string | null): string {
  const n = normalize(t);
  return TIPO[n] ?? (t ? t.toUpperCase().replace(/\s+/g, "_") : "CASA");
}

function tipoOperacion(o?: string | null): string {
  const n = normalize(o);
  if (n.includes("alquiler") && n.includes("temp")) return "ALQUILER_TEMPORAL";
  if (n.includes("alquiler")) return "ALQUILER";
  return "VENTA";
}

function moneda(c?: string | null): string {
  const n = (c ?? "").toUpperCase();
  if (n.includes("US") || n.includes("U$") || n.includes("DOLAR") || n.includes("DÓLAR")) return "USD";
  if (n.includes("AR") || n === "$" || n.includes("PESO")) return "ARS";
  return "USD";
}

function precio(n?: number | null): string {
  if (n === undefined || n === null) return "";
  return Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function stripHtml(s?: string | null): string {
  return (s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Separa la dirección combinada en calle / número / piso / departamento.
 * Extrae Piso y Depto por palabra clave, los saca del string, y toma el número
 * final del resto como número de calle. Best-effort (en el wizard se corrige).
 * Ej: "Uriburu 1734 Piso 1 Departamento B" → {calle:"Uriburu", numero:"1734",
 * piso:"1", departamento:"B"}.
 */
function splitAddress(address?: string | null): {
  calle: string;
  numero: string;
  piso: string;
  departamento: string;
} {
  let a = (address ?? "").trim();
  const piso = (a.match(/\bpiso\s+([\w-]+)/i) ?? [])[1] ?? "";
  const departamento = (a.match(/\b(?:departamento|depto|dpto|dto)\s+([\w-]+)/i) ?? [])[1] ?? "";
  a = a
    .replace(/\bpiso\s+[\w-]+/i, "")
    .replace(/\b(?:departamento|depto|dpto|dto)\s+[\w-]+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = a.match(/^(.*?)[\s,]+(\d+)\s*$/);
  if (m) return { calle: m[1].trim(), numero: m[2], piso, departamento };
  return { calle: a, numero: "", piso, departamento };
}

function n(v?: number | null): number | undefined {
  return v === undefined || v === null ? undefined : v;
}

/**
 * Construye el FichaInput desde una Property. Async porque resuelve la
 * ubicación contra ArgenProp (Provincia→Barrio). Lanza si no resuelve un
 * nivel obligatorio de ubicación.
 */
export async function propertyToFicha(p: PropertyLike): Promise<FichaInput> {
  // Fallback de provincia: el dataset actual no la trae (viene null) y es todo
  // GBA. CABA necesitaría detectarse aparte (o elegirse en el wizard).
  const province = p.province ?? "Buenos Aires";
  const location = await resolveLocation({ province, city: p.city, zone: p.zone });
  const tp = tipoPropiedad(p.type);
  const { calle, numero, piso, departamento } = splitAddress(p.address);

  return {
    tipoPropiedad: tp,
    tipoUnidad: tp,
    tipoOperacion: tipoOperacion(p.operationType),
    moneda: moneda(p.operationCurrency),
    precio: precio(p.operationPrice),
    titulo: (p.publicationTitle || p.address || "Propiedad").slice(0, 100),
    descripcion: stripHtml(p.description || p.richDescription),
    location: {
      idProvincia: location.idProvincia,
      idPartido: location.idPartido,
      idLocalidad: location.idLocalidad,
      idBarrio: location.idBarrio,
      nombreCalle: calle,
      numeroCalle: numero,
      piso,
      departamento,
    },
    caracteristicas: {
      ambientes: n(p.roomAmount),
      dormitorios: n(p.bedrooms),
      banos: n(p.bathroomAmount),
      cocheras: n(p.parkingLotAmount),
      plantas: n(p.floorsAmount),
      superficieCubierta: n(p.roofedSurface),
      superficieTerreno: n(p.totalSurface ?? p.surface),
      antiguedad: n(p.age),
    },
  };
}
