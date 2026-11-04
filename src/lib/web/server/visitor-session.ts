import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "jw_visitante";
export const NONCE_COOKIE = "jw_nonce";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function secret(): string | null {
  const value = process.env.WEB_SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function encodeSession(visitorId: string, key: string, now = Date.now()): string {
  const payload = `${visitorId}.${Math.floor(now / 1000) + MAX_AGE_SECONDS}`;
  return `${payload}.${sign(payload, key)}`;
}

export function decodeSession(value: string | undefined, key: string, now = Date.now()): string | null {
  if (!value) return null;
  const [id, expires, signature] = value.split(".");
  if (!id || !expires || !signature) return null;
  const expected = Buffer.from(sign(`${id}.${expires}`, key));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return Number(expires) * 1000 > now ? id : null;
}

export async function currentVisitorId(): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value, key);
}

export async function startVisitorSession(visitorId: string) {
  const key = secret();
  if (!key) throw new Error("WEB_SESSION_SECRET sin configurar");
  (await cookies()).set(SESSION_COOKIE, encodeSession(visitorId, key), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.WEB_INSECURE_COOKIES !== "1",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endVisitorSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export function googleWebClientId(): string | null {
  return (secret() && process.env.WEB_GOOGLE_CLIENT_ID) || null;
}
