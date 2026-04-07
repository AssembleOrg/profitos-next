import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";

type TokkoObject = Record<string, unknown>;

interface TokkoResponse {
  meta?: Record<string, unknown>;
  objects?: TokkoObject[];
}

interface SyncOptions {
  mode?: "auto" | "api";
}

const SYNC_KEY = "tokko_properties";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toInt(value: unknown): number | null {
  const num = toNumber(value);
  if (num === null) return null;
  return Math.trunc(num);
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractOperationData(operations: unknown) {
  const firstOperation = safeArray(operations)[0] as Record<string, unknown> | undefined;
  const firstPrice = safeArray(firstOperation?.prices)[0] as Record<string, unknown> | undefined;
  return {
    operationType: toText(firstOperation?.operation_type),
    operationPrice: toNumber(firstPrice?.price),
    operationCurrency: toText(firstPrice?.currency),
  };
}

function extractLocationData(location: unknown) {
  const loc = (location ?? {}) as Record<string, unknown>;
  const shortLocation = toText(loc.short_location);
  const parts = shortLocation?.split("|").map((part) => part.trim()).filter(Boolean) ?? [];
  const city = parts.length > 0 ? parts[parts.length - 1] : null;
  const zone = parts.length > 1 ? parts[parts.length - 2] : null;
  return {
    city,
    zone,
    locationShort: shortLocation,
    locationFull: toText(loc.full_location),
  };
}

function extractCoverImage(photos: unknown): string | null {
  const items = safeArray(photos) as Array<Record<string, unknown>>;
  const cover = items.find((item) => item.is_front_cover === true) ?? items[0];
  return toText(cover?.image) ?? toText(cover?.original) ?? null;
}

function mapTokkoStatus(item: Record<string, unknown>): string {
  const tokkoStatus = toInt(item.status);
  if (tokkoStatus === 2) return "activa";
  if (tokkoStatus === 3) return "vendida";
  if (tokkoStatus === 4) return "alquilada";
  if (tokkoStatus === 5) return "suspendida";

  if (toDate(item.deleted_at)) return "suspendida";
  const operationType = toText((safeArray(item.operations)[0] as Record<string, unknown> | undefined)?.operation_type)?.toLowerCase();
  if (operationType?.includes("alquiler")) return "alquilada";
  if (operationType?.includes("venta")) return "activa";
  return "activa";
}

function buildTokkoUrl(offset = 0, limit = 400): string {
  const base = process.env.TOKKO_API_URL;
  const key = process.env.TOKKO_API_KEY;
  if (!base) {
    throw new Error("Falta TOKKO_API_URL en variables de entorno");
  }
  if (!key) {
    throw new Error("Falta TOKKO_API_KEY en variables de entorno");
  }

  const url = new URL(base);
  url.searchParams.set("lang", "es_ar");
  url.searchParams.set("format", "json");
  url.searchParams.set("filtered_attributes", "true");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("key", key);
  return url.toString();
}

async function loadFromApi(offset: number, limit: number): Promise<TokkoResponse> {
  const url = buildTokkoUrl(offset, limit);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tokko API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokkoResponse;
}

function getPropertiesLimit(): number {
  const raw = toInt(process.env.TOKKO_PROPERTIES_LIMIT);
  if (!raw) return 400;
  return Math.max(1, Math.min(400, raw));
}

function mapTokkoToProperty(item: TokkoObject) {
  const object = item as Record<string, unknown>;
  const operations = extractOperationData(object.operations);
  const location = extractLocationData(object.location);

  const address =
    toText(object.real_address) ??
    toText(object.address) ??
    toText(object.fake_address) ??
    `Propiedad Tokko ${toInt(object.id) ?? "s/n"}`;

  return {
    tokkoId: toInt(object.id),
    source: "tokko",
    address,
    realAddress: toText(object.real_address),
    addressComplement: toText(object.address_complement),
    city: location.city,
    zone: location.zone,
    type: toText((object.type as Record<string, unknown> | null)?.name),
    status: mapTokkoStatus(object),
    publicationTitle: toText(object.publication_title),
    referenceCode: toText(object.reference_code),
    publicUrl: toText(object.public_url),
    description: toText(object.description),
    richDescription: toText(object.rich_description),
    age: toInt(object.age),
    roomAmount: toInt(object.room_amount),
    bathroomAmount: toInt(object.bathroom_amount),
    suiteAmount: toInt(object.suite_amount),
    parkingLotAmount: toInt(object.parking_lot_amount),
    floorsAmount: toInt(object.floors_amount),
    orientation: toText(object.orientation),
    disposition: toText(object.disposition),
    totalSurface: toNumber(object.total_surface),
    roofedSurface: toNumber(object.roofed_surface),
    surface: toNumber(object.surface),
    surfaceMeasurement: toText(object.surface_measurement),
    expenses: toNumber(object.expenses),
    operationType: operations.operationType,
    operationPrice: operations.operationPrice,
    operationCurrency: operations.operationCurrency,
    locationFull: location.locationFull,
    locationShort: location.locationShort,
    branchName: toText((object.branch as Record<string, unknown> | null)?.name),
    branchOffice: toText((object.branch as Record<string, unknown> | null)?.display_name),
    producerName: toText((object.producer as Record<string, unknown> | null)?.name),
    geoLat: toNumber(object.geo_lat),
    geoLong: toNumber(object.geo_long),
    coverImageUrl: extractCoverImage(object.photos),
    photos: safeArray(object.photos) as Prisma.InputJsonValue,
    videos: safeArray(object.videos) as Prisma.InputJsonValue,
    tags: safeArray(object.tags) as Prisma.InputJsonValue,
    extraAttributes: safeArray(object.extra_attributes) as Prisma.InputJsonValue,
    deletedAt: toDate(object.deleted_at),
    tokkoCreatedAt: toDate(object.created_at),
    tokkoUpdatedAt: toDate(object.updated_at),
    rawPayload: object as Prisma.InputJsonValue,
    syncAt: new Date(),
  };
}

async function upsertItems(items: TokkoObject[]) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const rawItem of items) {
    const mapped = mapTokkoToProperty(rawItem);
    if (!mapped.tokkoId) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.property.findUnique({
      where: { tokkoId: mapped.tokkoId },
      select: { id: true },
    });

    if (!existing) {
      await prisma.property.create({ data: mapped });
      created += 1;
      continue;
    }

    await prisma.property.update({
      where: { id: existing.id },
      data: mapped,
    });
    updated += 1;
  }

  return { created, updated, skipped };
}

export async function syncTokkoProperties(options: SyncOptions = {}) {
  const mode = options.mode ?? "auto";
  const resolvedMode = mode === "auto" ? "api" : mode;
  const limit = getPropertiesLimit();

  const state = await prisma.integrationSyncState.upsert({
    where: { integrationKey: SYNC_KEY },
    update: {},
    create: {
      integrationKey: SYNC_KEY,
      lastOffset: 0,
      lastTotalCount: 0,
      lastRunAt: new Date(),
    },
  });

  const metaProbe = await loadFromApi(0, 1);
  const totalCount = toInt((metaProbe.meta as Record<string, unknown> | undefined)?.total_count) ?? 0;
  const tokkoCountInDb = await prisma.property.count({ where: { source: "tokko" } });

  let startOffset: number;
  if (state.lastTotalCount <= 0) {
    startOffset = tokkoCountInDb > 0 ? Math.max(0, totalCount - limit) : 0;
  } else {
    startOffset = state.lastTotalCount;
  }

  if (totalCount <= startOffset) {
    await prisma.integrationSyncState.update({
      where: { integrationKey: SYNC_KEY },
      data: {
        lastOffset: startOffset,
        lastTotalCount: totalCount,
        lastRunAt: new Date(),
      },
    });

    return {
      mode: resolvedMode,
      sourceCount: totalCount,
      syncedCount: 0,
      startOffset,
      limit,
      noChanges: true,
      created: 0,
      updated: 0,
      skipped: 0,
      pagesFetched: 0,
      meta: metaProbe.meta ?? null,
    };
  }

  const itemsToSync: TokkoObject[] = [];
  let pagesFetched = 0;
  let lastMeta: Record<string, unknown> | null = metaProbe.meta ?? null;
  for (let offset = startOffset; offset < totalCount; offset += limit) {
    const pagePayload = await loadFromApi(offset, limit);
    pagesFetched += 1;
    lastMeta = (pagePayload.meta as Record<string, unknown> | undefined) ?? lastMeta;
    const objects = Array.isArray(pagePayload.objects) ? pagePayload.objects : [];
    if (objects.length === 0) break;
    itemsToSync.push(...objects);
  }

  const result = await upsertItems(itemsToSync);
  const lastOffset = startOffset + itemsToSync.length;

  await prisma.integrationSyncState.update({
    where: { integrationKey: SYNC_KEY },
    data: {
      lastOffset,
      lastTotalCount: totalCount,
      lastRunAt: new Date(),
    },
  });

  return {
    mode: resolvedMode,
    requestedMode: mode,
    sourceCount: totalCount,
    syncedCount: itemsToSync.length,
    startOffset,
    limit,
    noChanges: itemsToSync.length === 0,
    pagesFetched,
    ...result,
    meta: lastMeta,
  };
}
