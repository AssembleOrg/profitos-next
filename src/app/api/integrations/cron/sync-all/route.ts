import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { syncTokkoProperties } from "@/lib/tokko/sync";
import { syncTokkoContacts } from "@/lib/tokko/contacts-sync";
import { assertCronAuthorized } from "@/lib/server/cron-auth";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const secret = process.env.CRON_SECRET;
  assertCronAuthorized(request.headers, secret, request.nextUrl.searchParams.get("secret"));

  const [properties, consultants] = await Promise.all([
    syncTokkoProperties({ mode: "api" }),
    syncTokkoContacts({ mode: "api" }),
  ]);

  return ok(
    { properties, consultants },
    "Cron global ejecutado correctamente",
    path
  );
});
