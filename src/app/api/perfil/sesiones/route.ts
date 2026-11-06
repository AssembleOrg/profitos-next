import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getDeviceSession, listSessions, revokeOtherSessions, revokeSession } from "@/lib/auth/device-sessions";

// Dispositivos del usuario logueado.
//  GET                       → sesiones abiertas + historial
//  DELETE ?id=<sessionId>    → cierra esa sesión (no la actual)
//  POST { action: "others" } → cierra todas menos la actual

async function current() {
  const auth = await getAuthContext();
  const device = await getDeviceSession(auth.userId);
  return { auth, sessionId: device.status === "ok" ? device.sessionId : null };
}

export const GET = withHandler(async (request: NextRequest) => {
  const { auth, sessionId } = await current();
  return ok(await listSessions(auth.userId, sessionId), "Dispositivos", request.nextUrl.pathname);
});

export const DELETE = withHandler(async (request: NextRequest) => {
  const { auth, sessionId } = await current();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) throw new AppError(400, "Falta la sesión");
  if (id === sessionId) throw new AppError(400, "Para salir de este dispositivo usá Cerrar sesión");
  if (!(await revokeSession(auth.userId, id))) throw new AppError(404, "Sesión no encontrada");
  return ok(await listSessions(auth.userId, sessionId), "Sesión cerrada", request.nextUrl.pathname);
});

export const POST = withHandler(async (request: NextRequest) => {
  const { auth, sessionId } = await current();
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "others") throw new AppError(400, "Acción inválida");
  if (!sessionId) throw new AppError(409, "No se pudo identificar este dispositivo");
  const closed = await revokeOtherSessions(auth.userId, sessionId);
  return ok(
    { closed, sessions: await listSessions(auth.userId, sessionId) },
    closed === 1 ? "Se cerró 1 sesión" : `Se cerraron ${closed} sesiones`,
    request.nextUrl.pathname
  );
});
