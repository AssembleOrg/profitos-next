import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { getCatalog } from "../catalog";
import { browserFrom, channelFrom, deviceFrom, isBotAgent } from "./request-context";

export const EVENT_TYPES = new Set([
  "page_view",
  "search",
  "photo_open",
  "video_play",
  "favorite_add",
  "favorite_remove",
  "whatsapp_click",
  "phone_click",
  "email_click",
  "form_submit",
  "filters_open",
  "login",
  "phone_added",
  "development_click",
]);

const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

export type IncomingEvent = {
  id?: unknown;
  type?: unknown;
  path?: unknown;
  propertyKey?: unknown;
  query?: unknown;
  filters?: unknown;
  resultsCount?: unknown;
  durationMs?: unknown;
  scrollDepth?: unknown;
  label?: unknown;
};

export type IngestContext = {
  anonId: string;
  sessionId: string;
  visitorId: string | null;
  userAgent: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

const whole = (value: unknown, max: number): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.round(value), max);
};

function cleanFilters(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowed = ["op", "tipo", "zona", "amb", "dorm", "moneda", "min", "max", "sup", "orden"];
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const entry = text((value as Record<string, unknown>)[key], 80);
    if (entry) out[key] = entry;
  }
  return Object.keys(out).length ? out : null;
}

function hostOf(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").slice(0, 120);
  } catch {
    return null;
  }
}

export type CleanEvent = Omit<Prisma.WebEventUncheckedCreateInput, "id">;

/** Pasa cada evento por una lista permitida. Los datos de la propiedad salen del catálogo, no del navegador. */
export async function buildEvents(raw: IncomingEvent[], context: IngestContext): Promise<CleanEvent[]> {
  const catalog = new Map((await getCatalog()).map((item) => [item.key, item]));
  const referrerHost = hostOf(context.referrer);
  const shared = {
    anonId: context.anonId,
    sessionId: context.sessionId,
    visitorId: context.visitorId,
    device: deviceFrom(context.userAgent),
    browser: browserFrom(context.userAgent),
    channel: channelFrom(referrerHost, context.utmSource, context.utmMedium),
    referrerHost,
    utmSource: context.utmSource,
    utmCampaign: context.utmCampaign,
    isBot: isBotAgent(context.userAgent),
  };

  const events: CleanEvent[] = [];
  for (const item of raw) {
    const type = text(item.type, 40);
    const clientId = text(item.id, 80);
    if (!type || !clientId || !EVENT_TYPES.has(type)) continue;
    const property = catalog.get(text(item.propertyKey, 40) ?? "");
    const filters = cleanFilters(item.filters);
    const operation = property?.operation ?? filters?.op ?? null;
    events.push({
      ...shared,
      clientId,
      type,
      path: text(item.path, 300),
      propertyKey: property?.key ?? null,
      address: property?.address ?? null,
      operation,
      propertyType: property?.type ?? filters?.tipo ?? null,
      zone: property?.zone ?? filters?.zona ?? null,
      price: property?.price ?? null,
      currency: property?.currency ?? null,
      query: text(item.query, 200),
      filters: filters ?? undefined,
      resultsCount: whole(item.resultsCount, 100_000),
      durationMs: whole(item.durationMs, MAX_DURATION_MS),
      scrollDepth: whole(item.scrollDepth, 100),
      label: text(item.label, 120),
    });
  }
  return events;
}

/** Idempotente: el mismo id actualiza tiempo y scroll sin duplicar. */
export async function saveEvents(events: CleanEvent[]) {
  await Promise.all(
    events.map(({ clientId, durationMs, scrollDepth, visitorId, ...rest }) =>
      prisma.webEvent.upsert({
        where: { clientId },
        create: { ...rest, clientId, durationMs, scrollDepth, visitorId },
        update: {
          ...(typeof durationMs === "number" ? { durationMs } : {}),
          ...(typeof scrollDepth === "number" ? { scrollDepth } : {}),
          ...(visitorId ? { visitorId } : {}),
        },
      }),
    ),
  );
}

/** Lo que el navegador hizo antes de entrar con Google pasa a ser de esa persona. */
export async function linkAnonymousHistory(anonId: string, visitorId: string) {
  await prisma.webEvent.updateMany({ where: { anonId, visitorId: null }, data: { visitorId } });
}
