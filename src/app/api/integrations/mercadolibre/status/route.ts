import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getConnectionStatus } from "@/lib/mercadolibre/oauth";

// Estado de conexión de la cuenta de MercadoLibre.
export const GET = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const status = await getConnectionStatus();
  return ok(status, "Estado de MercadoLibre", request.nextUrl.pathname);
});
