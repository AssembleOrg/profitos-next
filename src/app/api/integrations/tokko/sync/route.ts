import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/api/followups";
import { syncTokkoProperties } from "@/lib/tokko/sync";
import { assertCronAuthorized } from "@/lib/server/cron-auth";

const g = globalThis as { _tokkoSyncing?: boolean; _tokkoLastSync?: number };
const COOLDOWN_MS = 10 * 60 * 1000;

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);

  const now = Date.now();

  if (g._tokkoSyncing) {
    return ok({ skipped: true, reason: "sync_in_progress" }, "Sincronización ya en curso", path);
  }

  if (g._tokkoLastSync && now - g._tokkoLastSync < COOLDOWN_MS) {
    const minutesLeft = Math.ceil((COOLDOWN_MS - (now - g._tokkoLastSync)) / 60000);
    return ok({ skipped: true, reason: "cooldown", minutesLeft }, `Cooldown activo (${minutesLeft} min restantes)`, path);
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "auto" | "api";
  };

  g._tokkoSyncing = true;
  try {
    const result = await syncTokkoProperties({ mode: body.mode ?? "auto" });
    g._tokkoLastSync = Date.now();
    return ok(result, "Sincronización Tokko completada", path);
  } finally {
    g._tokkoSyncing = false;
  }
});

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const secret = process.env.TOKKO_CRON_SECRET ?? process.env.CRON_SECRET;
  assertCronAuthorized(request.headers, secret, request.nextUrl.searchParams.get("secret"));

  const result = await syncTokkoProperties({ mode: "api" });
  return ok(result, "Cron Tokko ejecutado correctamente", path);
});
