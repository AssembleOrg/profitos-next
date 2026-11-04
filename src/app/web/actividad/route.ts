import { NextResponse } from "next/server";
import { buildEvents, saveEvents, type IncomingEvent } from "@/lib/web/server/ingest";
import { isSameOrigin } from "@/lib/web/server/same-origin";
import { currentVisitorId } from "@/lib/web/server/visitor-session";

const MAX_BYTES = 48 * 1024;
const MAX_EVENTS = 40;
const ID = /^[\w-]{8,64}$/;

// La ruta no se llama "analytics" ni "track": los bloqueadores filtran esas URL.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
  let body: { anonId?: unknown; sessionId?: unknown; events?: unknown; referrer?: unknown; utm?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const { anonId, sessionId } = body;
  if (typeof anonId !== "string" || !ID.test(anonId) || typeof sessionId !== "string" || !ID.test(sessionId) || !Array.isArray(body.events)) {
    return new NextResponse(null, { status: 400 });
  }
  const pick = (value: unknown) => (typeof value === "string" && value ? value.slice(0, 120) : null);
  const events = await buildEvents(body.events.slice(0, MAX_EVENTS) as IncomingEvent[], {
    anonId,
    sessionId,
    visitorId: await currentVisitorId(),
    userAgent: request.headers.get("user-agent") ?? "",
    referrer: pick(body.referrer),
    utmSource: pick(body.utm?.source),
    utmMedium: pick(body.utm?.medium),
    utmCampaign: pick(body.utm?.campaign),
  });
  try {
    await saveEvents(events);
  } catch (error) {
    console.error("[web/actividad]", error instanceof Error ? error.message : error);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
