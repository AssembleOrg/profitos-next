import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { isReloginPortal, finishRemoteLogin } from "@/lib/scraper/relogin-client";

// Cierra el login remoto: el worker valida que quedó logueado y guarda la sesión.
// Body: { portal, sessionId }
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const body = (await request.json().catch(() => ({}))) as { portal?: string; sessionId?: string };
  if (!body.portal || !isReloginPortal(body.portal)) throw new AppError(400, "Portal no soportado");
  if (!body.sessionId) throw new AppError(400, "Falta sessionId");
  try {
    const r = await finishRemoteLogin(body.portal, body.sessionId);
    return ok(r, r.message, path);
  } catch (e) {
    throw new AppError(502, e instanceof Error ? e.message : "No se pudo cerrar el login remoto");
  }
});
