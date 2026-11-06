import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getDeviceSession, setSessionLocation } from "@/lib/auth/device-sessions";

// POST { latitude, longitude, accuracy? } | { denied: true }
// Ubicación del dispositivo, tomada una sola vez al entrar.
export const POST = withHandler(async (request: NextRequest) => {
  const auth = await getAuthContext();
  const device = await getDeviceSession(auth.userId);
  if (device.status !== "ok") throw new AppError(409, "No se pudo identificar este dispositivo");

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.denied === true) {
    await setSessionLocation(auth.userId, device.sessionId, { denied: true });
    return ok(null, "Sin ubicación", request.nextUrl.pathname);
  }

  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new AppError(400, "Ubicación inválida");
  }
  const acc = Number(body.accuracy);
  const place = await setSessionLocation(auth.userId, device.sessionId, {
    latitude: lat,
    longitude: lng,
    accuracy: Number.isFinite(acc) && acc >= 0 ? acc : null,
  });
  return ok(place, "Ubicación guardada", request.nextUrl.pathname);
});
