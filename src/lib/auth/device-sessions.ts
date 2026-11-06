import { cache } from "react";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import {
  claimsFromAccessToken,
  clientIp,
  deviceLabel,
  placeFromNominatim,
  unseenSessionAllowed,
} from "./device-utils";

/**
 * Sesiones por dispositivo del equipo.
 *
 * Cada sesión de Supabase Auth (session_id del JWT) tiene una fila en
 * jp_user_sessions. La fila se crea sola la primera vez que la sesión abre el
 * sistema (sirve igual para sesiones de antes de esta función). Cerrar una
 * sesión marca revoked_at y borra la sesión de Supabase para que no se pueda
 * renovar; el chequeo de revoked_at corta el acceso al instante.
 */

const TOUCH_EVERY_MS = 5 * 60 * 1000;
const NOMINATIM_UA = "profitos-next/1.0 (Juliana Profitos Propiedades)";

export type DeviceSessionState =
  | { status: "ok"; sessionId: string; needsLocation: boolean }
  | { status: "revoked" }
  | { status: "unknown" }; // token sin session_id (no debería pasar)

async function resolve(userId: string, accessToken: string | null | undefined): Promise<DeviceSessionState> {
  const { sessionId, signedInAt } = claimsFromAccessToken(accessToken);
  if (!sessionId) return { status: "unknown" };

  const row = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, revokedAt: true, lastSeenAt: true, locationSource: true },
  });

  if (row) {
    if (row.userId !== userId || row.revokedAt) return { status: "revoked" };
    if (Date.now() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      prisma.userSession.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    }
    return { status: "ok", sessionId, needsLocation: row.locationSource == null };
  }

  // Primera vez que vemos esta sesión: registrarla como dispositivo.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionsRevokedAt: true } });
  const allowed = unseenSessionAllowed(signedInAt, user?.sessionsRevokedAt);
  const h = await headers();
  const userAgent = h.get("user-agent")?.slice(0, 500) ?? null;
  await prisma.userSession
    .create({
      data: {
        id: sessionId,
        userId,
        userAgent,
        device: deviceLabel(userAgent),
        ip: clientIp(h),
        ...(signedInAt ? { createdAt: new Date(signedInAt) } : {}),
        ...(allowed ? {} : { revokedAt: new Date() }),
      },
    })
    .catch(() => undefined); // carrera entre dos requests del mismo login: gana el primero
  if (!allowed) {
    deleteAuthSessions(userId, [sessionId]);
    return { status: "revoked" };
  }
  return { status: "ok", sessionId, needsLocation: true };
}

async function accessTokenOf(supabase: SupabaseClient): Promise<string | null> {
  // getUser() ya validó el token; acá solo se lee el session_id del mismo JWT.
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Estado de la sesión del dispositivo actual. Llamar después de validar el
 * usuario con getUser(). Cacheado por request en Server Components.
 */
export const getDeviceSession = cache(async (userId: string): Promise<DeviceSessionState> => {
  const supabase = await createClient();
  return resolve(userId, await accessTokenOf(supabase));
});

/** Borra sesiones de Supabase Auth para que no se puedan renovar. Mejor esfuerzo. */
function deleteAuthSessions(userId: string, sessionIds: string[]) {
  if (!sessionIds.length) return;
  prisma
    .$executeRawUnsafe(
      `DELETE FROM auth.sessions WHERE user_id = $1::uuid AND id = ANY($2::uuid[])`,
      userId,
      sessionIds
    )
    .catch((e: unknown) => console.warn("[sesiones] no se pudo borrar en auth.sessions:", (e as Error).message));
}

export async function listSessions(userId: string, currentSessionId: string | null) {
  const sessions = await prisma.userSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return sessions.map((s) => ({
    id: s.id,
    device: s.device,
    ip: s.ip,
    locality: s.locality,
    area: s.area,
    region: s.region,
    latitude: s.latitude,
    longitude: s.longitude,
    accuracy: s.accuracy,
    locationSource: s.locationSource,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    revokedAt: s.revokedAt?.toISOString() ?? null,
    active: !s.revokedAt,
    current: s.id === currentSessionId,
  }));
}

export type DeviceSessionDTO = Awaited<ReturnType<typeof listSessions>>[number];

/** Cierra una sesión de la cuenta. false si no existe o no es del usuario. */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const exists = await prisma.userSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
  if (!exists) return false;
  await prisma.userSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  deleteAuthSessions(userId, [sessionId]);
  return true;
}

/** Cierra todas las sesiones menos la actual (incluidas las que todavía no tienen fila). */
export async function revokeOtherSessions(userId: string, currentSessionId: string) {
  const now = new Date();
  const others = await prisma.userSession.findMany({
    where: { userId, revokedAt: null, id: { not: currentSessionId } },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.userSession.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: now },
    }),
    prisma.user.update({ where: { id: userId }, data: { sessionsRevokedAt: now } }),
  ]);
  // Supabase: todas las del usuario menos la actual (también las nunca vistas).
  prisma
    .$executeRawUnsafe(`DELETE FROM auth.sessions WHERE user_id = $1::uuid AND id <> $2::uuid`, userId, currentSessionId)
    .catch((e: unknown) => console.warn("[sesiones] no se pudo borrar en auth.sessions:", (e as Error).message));
  return others.length;
}

/** Guarda la ubicación del navegador (una vez, al entrar) o que no dio permiso. */
export async function setSessionLocation(
  userId: string,
  sessionId: string,
  loc: { latitude: number; longitude: number; accuracy?: number | null } | { denied: true }
) {
  const session = await prisma.userSession.findFirst({ where: { id: sessionId, userId, revokedAt: null }, select: { id: true } });
  if (!session) return null;

  if ("denied" in loc) {
    await prisma.userSession.update({ where: { id: sessionId }, data: { locationSource: "denied" } });
    return { area: null, locality: null };
  }

  const place = await reverseGeocode(loc.latitude, loc.longitude);
  const updated = await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy ?? null,
      locationSource: "gps",
      ...(place ?? { locality: null, area: null, region: null, country: null }),
    },
  });
  return { area: updated.area, locality: updated.locality };
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { address?: Record<string, unknown> };
    return placeFromNominatim(body?.address);
  } catch (e) {
    console.warn("[sesiones] reverse geocode falló:", (e as Error).message);
    return null;
  }
}
