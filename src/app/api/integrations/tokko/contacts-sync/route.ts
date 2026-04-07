import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/api/followups";
import { syncTokkoContacts } from "@/lib/tokko/contacts-sync";
import { assertCronAuthorized } from "@/lib/server/cron-auth";

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);

  const body = (await request.json().catch(() => ({}))) as { mode?: "auto" | "api" };

  const result = await syncTokkoContacts({ mode: body.mode ?? "auto" });
  return ok(result, "Sincronización de contactos completada", path);
});

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const secret = process.env.TOKKO_CONTACTS_CRON_SECRET ?? process.env.CRON_SECRET;
  assertCronAuthorized(request.headers, secret, request.nextUrl.searchParams.get("secret"));

  const result = await syncTokkoContacts({ mode: "api" });
  return ok(result, "Cron de contactos ejecutado correctamente", path);
});
