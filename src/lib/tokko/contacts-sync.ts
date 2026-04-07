import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

type TokkoObject = Record<string, unknown>;

interface TokkoMeta {
  limit?: number;
  offset?: number;
  total_count?: number;
  next?: string | null;
  previous?: string | null;
}

interface TokkoResponse {
  meta?: TokkoMeta;
  objects?: TokkoObject[];
}

interface SyncOptions {
  mode?: "auto" | "api";
}

const SYNC_KEY = "tokko_contacts";

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getContactsLimit(): number {
  const raw = toInt(process.env.TOKKO_CONTACTS_LIMIT);
  if (!raw) return 50;
  return Math.max(1, Math.min(100, raw));
}

function getInitialOffset(): number {
  const raw = toInt(process.env.TOKKO_CONTACTS_INITIAL_OFFSET);
  if (raw === null) return 8700;
  return Math.max(0, raw);
}

function getContactsBaseUrl(): string {
  const base = process.env.TOKKO_CONTACTS_API_URL;
  if (base?.trim()) return base;
  return "https://www.tokkobroker.com/api/v1/contact/";
}

function getApiKey(): string {
  const key = process.env.TOKKO_API_KEY;
  if (!key) throw new Error("Falta TOKKO_API_KEY en variables de entorno");
  return key;
}

function buildContactsUrl(offset: number, limit: number): string {
  const url = new URL(getContactsBaseUrl());
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("key", getApiKey());
  return url.toString();
}

async function loadContactsPage(offset: number, limit: number): Promise<TokkoResponse> {
  const res = await fetch(buildContactsUrl(offset, limit), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tokko contacts API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokkoResponse;
}

function mapContact(item: TokkoObject) {
  const data = item as Record<string, unknown>;
  const agent = (data.agent ?? {}) as Record<string, unknown>;
  const tags = safeArray(data.tags);

  return {
    tokkoContactId: toInt(data.id),
    source: "tokko",
    name: toText(data.name) ?? `Contacto Tokko ${toInt(data.id) ?? "s/n"}`,
    email: toText(data.email),
    phone: toText(data.phone),
    cellphone: toText(data.cellphone),
    leadStatus: toText(data.lead_status),
    isCompany: toBoolean(data.is_company),
    isOwner: toBoolean(data.is_owner),
    agentId: toInt(agent.id),
    agentName: toText(agent.name),
    agentEmail: toText(agent.email),
    agentPhone: toText(agent.phone) ?? toText(agent.cellphone),
    tags: tags as Prisma.InputJsonValue,
    tokkoCreatedAt: toDate(data.created_at),
    tokkoDeletedAt: toDate(data.deleted_at),
    rawPayload: data as Prisma.InputJsonValue,
    syncAt: new Date(),
  };
}

async function upsertContacts(items: TokkoObject[]) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of items) {
    const mapped = mapContact(raw);
    const tokkoContactId = mapped.tokkoContactId;
    if (!tokkoContactId) {
      skipped += 1;
      continue;
    }
    const data = { ...mapped, tokkoContactId };

    const existing = await prisma.recentContact.findUnique({
      where: { tokkoContactId },
      select: { id: true },
    });

    if (!existing) {
      await prisma.recentContact.create({ data });
      created += 1;
      continue;
    }

    await prisma.recentContact.update({
      where: { id: existing.id },
      data,
    });
    updated += 1;
  }

  return { created, updated, skipped };
}

async function getOrCreateState() {
  return prisma.integrationSyncState.upsert({
    where: { integrationKey: SYNC_KEY },
    update: {},
    create: {
      integrationKey: SYNC_KEY,
      lastOffset: getInitialOffset(),
      lastTotalCount: 0,
      lastRunAt: new Date(),
    },
  });
}

async function seedFromLocalJsonIfEmpty(
  state: { integrationKey: string; lastOffset: number; lastTotalCount: number }
) {
  const existingCount = await prisma.recentContact.count();
  if (existingCount > 0) return null;

  const seedPath = path.join(process.cwd(), "last_consultants.json");
  let parsed: TokkoResponse;
  try {
    const raw = await readFile(seedPath, "utf8");
    parsed = JSON.parse(raw) as TokkoResponse;
  } catch {
    return null;
  }

  const objects = Array.isArray(parsed.objects) ? parsed.objects : [];
  if (objects.length === 0) return null;

  const result = await upsertContacts(objects);
  const metaTotal = toInt(parsed.meta?.total_count);
  const metaOffset = toInt(parsed.meta?.offset) ?? 0;
  const computedOffset = metaOffset + objects.length;
  const nextTotal = metaTotal ?? Math.max(state.lastTotalCount, computedOffset);

  await prisma.integrationSyncState.update({
    where: { integrationKey: SYNC_KEY },
    data: {
      lastOffset: computedOffset,
      lastTotalCount: nextTotal,
      lastRunAt: new Date(),
    },
  });

  return {
    mode: "seed",
    sourceCount: nextTotal,
    startOffset: metaOffset,
    syncedCount: objects.length,
    pagesFetched: 0,
    noChanges: false,
    seededFromFile: true,
    seedPath,
    ...result,
  };
}

export async function syncTokkoContacts(options: SyncOptions = {}) {
  const mode = options.mode ?? "auto";
  const resolvedMode = mode === "auto" ? "api" : mode;
  const limit = getContactsLimit();
  const state = await getOrCreateState();

  const seeded = await seedFromLocalJsonIfEmpty(state);
  if (seeded) {
    return seeded;
  }

  const metaProbe = await loadContactsPage(0, 1);
  const totalCount = toInt(metaProbe.meta?.total_count) ?? 0;
  const initialOffset = getInitialOffset();

  let startOffset: number;
  if (state.lastTotalCount <= 0) {
    startOffset = Math.min(initialOffset, Math.max(0, totalCount - limit));
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
      startOffset,
      syncedCount: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      noChanges: true,
      pagesFetched: 0,
    };
  }

  const pages: TokkoObject[] = [];
  let pagesFetched = 0;
  for (let offset = startOffset; offset < totalCount; offset += limit) {
    const page = await loadContactsPage(offset, limit);
    pagesFetched += 1;
    const objects = Array.isArray(page.objects) ? page.objects : [];
    if (objects.length === 0) break;
    pages.push(...objects);
  }

  const result = await upsertContacts(pages);
  const lastOffset = startOffset + pages.length;

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
    sourceCount: totalCount,
    startOffset,
    syncedCount: pages.length,
    pagesFetched,
    noChanges: pages.length === 0,
    ...result,
  };
}
