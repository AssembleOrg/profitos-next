import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/api/followups";
import { fullSyncTokkoContacts } from "@/lib/tokko/contacts-sync";
import { assertCronAuthorized } from "@/lib/server/cron-auth";

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);

  const body = (await request.json().catch(() => ({}))) as { reset?: boolean };

  const result = await fullSyncTokkoContacts({ reset: body.reset });
  return ok(result, "Batch de sync completo ejecutado", path);
});

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const secret = process.env.TOKKO_CONTACTS_CRON_SECRET ?? process.env.TOKKO_CRON_SECRET ?? process.env.CRON_SECRET;
  assertCronAuthorized(request.headers, secret, request.nextUrl.searchParams.get("secret"));

  const result = await fullSyncTokkoContacts();
  return ok(result, "Cron de full sync ejecutado", path);
});
