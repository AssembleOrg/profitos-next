import crypto from "node:crypto";

/**
 * Token corto y firmado (HMAC) para autorizar una sesión de re-login remoto.
 * Lo emite la web (Next) y lo verifica el worker: así el endpoint de login
 * remoto del worker sólo acepta pedidos que salieron de un usuario logueado.
 *
 * Formato: base64url(payload).base64url(hmac)  — payload = {portal, exp}.
 */
type ReloginClaims = { portal: string; exp: number };

function secret(): string {
  const s = process.env.RELOGIN_SHARED_SECRET?.trim();
  if (!s) throw new Error("Falta RELOGIN_SHARED_SECRET");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Firma un token válido por `ttlSec` segundos (default 15 min). */
export function signReloginToken(portal: string, ttlSec = 900): string {
  const payload: ReloginClaims = { portal, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const mac = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${mac}`;
}

/** Verifica firma y expiración. Devuelve el portal o null si es inválido. */
export function verifyReloginToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  const a = unb64url(mac);
  const b = unb64url(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(unb64url(body).toString("utf-8")) as ReloginClaims;
    if (!claims.portal || typeof claims.exp !== "number") return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims.portal;
  } catch {
    return null;
  }
}
