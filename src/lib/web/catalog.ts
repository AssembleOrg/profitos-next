import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma/client";
import { HIDDEN_PROPERTY_SOURCES } from "@/lib/domain/types";
import { PUBLISHED } from "./published-snapshot";
import {
  normalizeOperation,
  normalizeText,
  isUsd,
  slugify,
  WEB_BASE,
  type Operation,
} from "./format";

/**
 * Catálogo de la web pública.
 *
 * Toda lectura pasa por este archivo: los `select` enumeran campo por campo lo
 * que se puede publicar. No agregar acá `realAddress`, `ownerReportData`,
 * `producerName`, responsables ni datos de contacto de dueños. `rawPayload` se lee
 * solo para sacar `fake_address` e `is_starred_on_web`, y nunca sale de este archivo.
 *
 * `deletedAt` no se usa: viene de Tokko, las 346 migradas lo tienen cargado y gran
 * parte sigue publicada. Por eso no indica baja, igual que en el catálogo interno.
 */
const PUBLIC_WHERE = {
  status: "activa",
  source: { notIn: HIDDEN_PROPERTY_SOURCES },
  operationType: { not: null },
};

const SUMMARY_SELECT = {
  id: true,
  externalId: true,
  address: true,
  city: true,
  zone: true,
  locationShort: true,
  type: true,
  operationType: true,
  operationPrice: true,
  operationCurrency: true,
  roomAmount: true,
  bedrooms: true,
  bathroomAmount: true,
  parkingLotAmount: true,
  totalSurface: true,
  roofedSurface: true,
  surface: true,
  age: true,
  geoLat: true,
  geoLong: true,
  coverImageUrl: true,
  photos: true,
  referenceCode: true,
  source: true,
  rawPayload: true,
  externalUpdatedAt: true,
  updatedAt: true,
} as const;

export type PublicSummary = {
  id: string;
  key: string;
  href: string;
  address: string;
  zone: string;
  type: string;
  operation: Operation;
  price: number | null;
  currency: string | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  surface: number | null;
  age: number | null;
  cover: string | null;
  coverLarge: string | null;
  reference: string | null;
  starred: boolean;
  updatedAt: string;
  /** Coordenada redondeada (~100 m): la ubicación exacta no se publica. */
  lat: number | null;
  lng: number | null;
};

type RawPhoto = {
  image?: string;
  thumb?: string;
  original?: string;
  order?: number;
  is_front_cover?: boolean;
  is_blueprint?: boolean;
  description?: string | null;
};

function readPhotos(value: unknown): RawPhoto[] {
  if (!Array.isArray(value)) return [];
  return (value as RawPhoto[])
    .filter((photo) => photo && typeof photo.image === "string" && !photo.is_blueprint)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1).toLowerCase() : text;
}

/** Tokko mezcla "Local" y "Locales", "Galpon" y "Galpón": se unifica para los filtros. */
function normalizeType(raw: string | null): string {
  const value = normalizeText(raw ?? "").trim();
  const known: Record<string, string> = {
    locales: "Local",
    local: "Local",
    galpon: "Galpón",
    deposito: "Depósito",
    ph: "PH",
  };
  return known[value] ?? (capitalize((raw ?? "Propiedad").trim()) || "Propiedad");
}

function publicKey(row: { externalId: number | null; id: string }): string {
  return row.externalId !== null ? String(row.externalId) : row.id;
}

type SummaryRow = {
  id: string;
  externalId: number | null;
  address: string;
  city: string | null;
  zone: string | null;
  locationShort: string | null;
  type: string | null;
  operationType: string | null;
  operationPrice: number | null;
  operationCurrency: string | null;
  roomAmount: number | null;
  bedrooms: number | null;
  bathroomAmount: number | null;
  parkingLotAmount: number | null;
  totalSurface: number | null;
  roofedSurface: number | null;
  surface: number | null;
  age: number | null;
  geoLat: number | null;
  geoLong: number | null;
  coverImageUrl: string | null;
  photos: unknown;
  referenceCode: string | null;
  source: string;
  rawPayload: unknown;
  externalUpdatedAt: Date | null;
  updatedAt: Date;
};

/**
 * Dirección de portada. `address` trae altura y piso reales ("Mitre 1144 9°A");
 * lo publicable es `fake_address`. Sin ese dato, como en las cargas a mano, se
 * redondea la altura a la centena y se descarta la unidad.
 */
function publicAddress(row: SummaryRow): string {
  const fake = (row.rawPayload as { fake_address?: unknown } | null)?.fake_address;
  if (typeof fake === "string" && fake.trim()) return fake.replace(/\s+/g, " ").trim();
  const address = row.address.replace(/\s+/g, " ").trim();
  const match = address.match(/^(.*?)\s+al\s+(\d{1,5})\b/i) ?? address.match(/^(.*?\D)\s+(\d{1,5})\b/);
  return match ? `${match[1].trim()} al ${Math.floor(Number(match[2]) / 100) * 100}` : address;
}

function toSummary(row: SummaryRow): PublicSummary | null {
  const published = row.source === "tokko" ? PUBLISHED[row.externalId ?? -1] : null;
  if (row.source === "tokko" && !published) return null;
  const operation = normalizeOperation(published?.[0] ?? row.operationType);
  if (!operation) return null;
  const photos = readPhotos(row.photos);
  const front = photos.find((photo) => photo.is_front_cover) ?? photos[0];
  const type = normalizeType(row.type);
  const zone = (row.city || row.locationShort || row.zone || "Quilmes").trim();
  const key = publicKey(row);
  const address = publicAddress(row);
  const rawPrice = published ? published[1] : row.operationPrice;
  // Cero metros significa "sin cargar", no una propiedad de 0 m²: no se muestra.
  const surface = [row.totalSurface, row.roofedSurface, row.surface].find((value) => value && value > 0) ?? null;
  return {
    id: row.id,
    key,
    href: `${WEB_BASE}/p/${key}-${slugify(`${type} en ${operation} en ${zone} ${address}`)}`,
    address,
    zone,
    type,
    operation,
    price: rawPrice && rawPrice > 0 ? rawPrice : null,
    currency: published?.[2] ?? row.operationCurrency,
    rooms: row.roomAmount || null,
    bedrooms: row.bedrooms || null,
    bathrooms: row.bathroomAmount || null,
    parking: row.parkingLotAmount || null,
    surface,
    age: row.age,
    cover: front?.thumb ?? row.coverImageUrl ?? null,
    coverLarge: front?.image ?? row.coverImageUrl ?? null,
    reference: cleanReference(row.referenceCode),
    starred: (row.rawPayload as { is_starred_on_web?: unknown } | null)?.is_starred_on_web === true,
    updatedAt: (row.externalUpdatedAt ?? row.updatedAt).toISOString(),
    ...publicCoords(row.geoLat, row.geoLong),
  };
}

/** Los códigos de portal ("494768::ZP-M-48019042") no le sirven al visitante. */
function cleanReference(code: string | null): string | null {
  if (!code || code.includes("::")) return null;
  return code;
}

/** Se cachea el resumen sin el JSON de fotos completo: 5 minutos alcanzan para reflejar altas y bajas. */
export const getCatalog = unstable_cache(
  async (): Promise<PublicSummary[]> => {
    const rows = await prisma.property.findMany({
      where: PUBLIC_WHERE,
      select: SUMMARY_SELECT,
      orderBy: [{ externalUpdatedAt: "desc" }, { updatedAt: "desc" }],
    });
    const items = rows.map(toSummary).filter((row): row is PublicSummary => row !== null);
    // Lo que todavía no tiene fotos va al final.
    return [...items.filter((item) => item.coverLarge), ...items.filter((item) => !item.coverLarge)];
  },
  ["web-catalog"],
  { revalidate: 300, tags: ["web-catalog"] },
);

export type PublicGroup = {
  lead: PublicSummary;
  /** Dirección del edificio cuando agrupa varias unidades. */
  title: string;
  units: number;
  members: PublicSummary[];
  /** Precio más bajo, solo si todas las unidades comparten moneda. */
  fromPrice: number | null;
};

/** "Lavalle al 1162, 8°", "Mitre 1144 - 2°" y "Alvear al 1100 6ºB - Anton" → dirección sin la unidad. */
function buildingAddress(address: string): string | null {
  return address.match(/^(.+?)(?:\s*,|\s+-\s|\s+\d+\s*[º°])/)?.[1]?.trim() ?? null;
}

/**
 * Las unidades de un edificio se publican como avisos separados: sin agruparlas
 * el listado repite ocho veces la misma imagen. Se agrupan por dirección de
 * edificio y, como esa dirección a veces se carga distinta ("Lavalle al 1100, 8°"
 * y "Lavalle al 1162, 7°"), también por portada, tipo y operación.
 */
export function groupUnits(items: PublicSummary[]): PublicGroup[] {
  const groups: PublicSummary[][] = [];
  const index = new Map<string, PublicSummary[]>();
  for (const item of items) {
    const building = buildingAddress(item.address);
    const keys = [
      building ? `edificio|${normalizeText(building)}|${item.type}|${item.operation}` : null,
      item.cover ? `portada|${item.cover}|${item.type}|${item.operation}` : null,
    ].filter((key): key is string => key !== null);
    const existing = keys.map((key) => index.get(key)).find(Boolean);
    const group = existing ?? [];
    if (!existing) groups.push(group);
    group.push(item);
    for (const key of keys) index.set(key, group);
  }
  return groups.map((units) => {
    const sorted = [...units].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    const sameCurrency = new Set(units.map((unit) => isUsd(unit.currency))).size === 1;
    const lead = units.length > 1 ? sorted[0] : units[0];
    return {
      lead,
      title: units.length > 1 ? buildingAddress(lead.address) ?? lead.address : lead.address,
      units: units.length,
      members: units,
      fromPrice: units.length > 1 && sameCurrency ? sorted[0].price : null,
    };
  });
}

export type CatalogFilters = {
  op?: string;
  tipo?: string;
  zona?: string;
  amb?: string;
  dorm?: string;
  moneda?: string;
  min?: string;
  max?: string;
  q?: string;
  sup?: string;
  ids?: string;
};

export function filterCatalog(items: PublicSummary[], filters: CatalogFilters): PublicSummary[] {
  const words = normalizeText(filters.q ?? "").split(/\s+/).filter(Boolean);
  const ids = filters.ids ? new Set(filters.ids.split(",")) : null;
  const rooms = Number(filters.amb);
  const bedrooms = Number(filters.dorm);
  const min = Number(filters.min);
  const max = Number(filters.max);
  const surface = Number(filters.sup);
  const usd = filters.moneda ? filters.moneda === "USD" : null;

  return items.filter((item) => {
    if (ids && !ids.has(item.key)) return false;
    if (filters.op && item.operation !== filters.op) return false;
    if (filters.tipo && item.type !== filters.tipo) return false;
    if (filters.zona && item.zone !== filters.zona) return false;
    if (rooms && (rooms >= 5 ? (item.rooms ?? 0) < 5 : item.rooms !== rooms)) return false;
    if (bedrooms && (item.bedrooms ?? 0) < bedrooms) return false;
    if (surface && (item.surface ?? 0) < surface) return false;
    if (usd !== null && (min || max || filters.moneda)) {
      if (isUsd(item.currency) !== usd) return false;
    }
    if (min && (item.price ?? 0) < min) return false;
    if (max && (item.price === null || item.price > max)) return false;
    if (words.length) {
      const haystack = normalizeText(`${item.address} ${item.zone} ${item.type} ${item.reference ?? ""} ${item.key}`);
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

export function sortCatalog(items: PublicSummary[], order?: string): PublicSummary[] {
  const sorted = [...items];
  if (order === "precio-asc") sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (order === "precio-desc") sorted.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  if (order === "superficie") sorted.sort((a, b) => (b.surface ?? -1) - (a.surface ?? -1));
  return sorted;
}

export function catalogOptions(items: PublicSummary[]) {
  const count = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    types: count(items.map((item) => item.type)),
    zones: count(items.map((item) => item.zone)),
  };
}

/** El mapa público nunca recibe la coordenada exacta: se redondea a unos 100 m. */
/** Fuera de Argentina es un error de carga (ej. el signo cambiado): mejor sin mapa que en otro país. */
function publicCoords(lat: number | null, lng: number | null): { lat: number | null; lng: number | null } {
  const valid = lat !== null && lng !== null && lat > -55.5 && lat < -21 && lng > -74 && lng < -53;
  return valid ? { lat: approximate(lat), lng: approximate(lng) } : { lat: null, lng: null };
}

function approximate(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(3));
}

export type PublicDetail = PublicSummary & {
  description: string | null;
  photos: { src: string; thumb: string; alt: string }[];
  videos: string[];
  features: string[];
  orientation: string | null;
  disposition: string | null;
  expenses: number | null;
  roofedSurface: number | null;
};

function youtubeId(url: string): string | null {
  return url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}

function readVideos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((video) => youtubeId(typeof video === "string" ? video : String((video as { url?: string; player_url?: string })?.player_url ?? (video as { url?: string })?.url ?? "")))
    .filter((id): id is string => Boolean(id));
}

/** Tokko: 1 servicios, 2 ambientes, 3 adicionales. El resto son etiquetas internas ("Potencial alto para alquilar"). */
const PUBLIC_TAG_TYPES = new Set([1, 2, 3]);

function readFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value
    .filter((tag) => typeof tag === "string" || PUBLIC_TAG_TYPES.has((tag as { type?: number })?.type ?? -1))
    .map((tag) => (typeof tag === "string" ? tag : (tag as { name?: string })?.name))
    .filter((name): name is string => Boolean(name?.trim()));
  return [...new Set(names)];
}

export async function getPropertyByKey(key: string): Promise<PublicDetail | null> {
  const externalId = /^\d+$/.test(key) ? Number(key) : null;
  if (externalId === null && !/^[a-z0-9]{20,}$/i.test(key)) return null;
  const row = await prisma.property.findFirst({
    where: { ...PUBLIC_WHERE, ...(externalId !== null ? { externalId } : { id: key }) },
    select: {
      ...SUMMARY_SELECT,
      description: true,
      videos: true,
      tags: true,
      orientation: true,
      disposition: true,
      expenses: true,
    },
  });
  if (!row) return null;
  const summary = toSummary(row);
  if (!summary) return null;
  const alt = `${summary.type} en ${summary.address}, ${summary.zone}`;
  const photos = readPhotos(row.photos);
  return {
    ...summary,
    description: row.description?.trim() || null,
    photos: photos.map((photo, index) => ({
      src: photo.image as string,
      thumb: photo.thumb ?? (photo.image as string),
      alt: photo.description?.trim() || `${alt}, foto ${index + 1}`,
    })),
    videos: readVideos(row.videos),
    features: readFeatures(row.tags),
    orientation: row.orientation,
    disposition: row.disposition,
    expenses: row.expenses && row.expenses > 0 ? row.expenses : null,
    roofedSurface: row.roofedSurface && row.roofedSurface > 0 ? row.roofedSurface : null,
  };
}
