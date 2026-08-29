import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { isReloginPortal, cancelRemoteLogin } from "@/lib/scraper/relogin-client";

// Cancela el login remoto sin guardar (cerrar modal / botón cancelar).
// Body: { portal }
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const body = (await request.json().catch(() => ({}))) as { portal?: string };
  if (!body.portal || !isReloginPortal(body.portal)) throw new AppError(400, "Portal no soportado");
  try {
    await cancelRemoteLogin(body.portal);
  } catch {
    /* si el worker ya no la tenía, no importa */
  }
  return ok({ ok: true }, "Login remoto cancelado", path);
});
