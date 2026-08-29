import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { isReloginPortal, startRemoteLogin } from "@/lib/scraper/relogin-client";

// Arranca una sesión de login remoto (opción B): el worker abre el navegador y
// devuelve la URL del visor noVNC para que el cliente se loguee a mano.
// Body: { portal }
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const body = (await request.json().catch(() => ({}))) as { portal?: string };
  if (!body.portal || !isReloginPortal(body.portal)) {
    throw new AppError(400, "Portal no soportado (zonaprop, argenprop, argenprop-gestion)");
  }
  try {
    const r = await startRemoteLogin(body.portal);
    return ok(r, "Login remoto iniciado", path);
  } catch (e) {
    throw new AppError(502, e instanceof Error ? e.message : "No se pudo iniciar el login remoto");
  }
});
