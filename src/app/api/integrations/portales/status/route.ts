import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getPortalStatuses } from "@/lib/publish/portal-status";

// Estado de conexión de todos los portales (ML + ZonaProp + ArgenProp).
export const GET = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const portals = await getPortalStatuses();
  return ok({ portals }, "Estado de portales", request.nextUrl.pathname);
});
