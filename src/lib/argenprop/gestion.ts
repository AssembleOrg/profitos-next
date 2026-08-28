/**
 * Cliente HTTP de ArgenProp Gestión (gestion.argenprop.com).
 *
 * A diferencia de ZonaProp, publicar en ArgenProp NO necesita navegador: es un
 * wizard MVC clásico y los endpoints de escritura solo piden las cookies de
 * sesión (sin token ni captcha). Solo el LOGIN tiene reCAPTCHA → se hace una
 * vez con navegador (scripts/scraper/login.ts argenprop-gestion) y acá reusamos
 * esas cookies con fetch de Node. Corre en Railway sin proxy (ArgenProp no
 * bloquea la IP de datacenter).
 */
import { prisma } from "@/lib/prisma/client";

export const GESTION_PORTAL = "argenprop-gestion";
const BASE = "https://gestion.argenprop.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

export class GestionSessionExpiredError extends Error {
  constructor() {
    super("Sesión de ArgenProp Gestión expirada. Re-logueá: login.ts argenprop-gestion");
    this.name = "GestionSessionExpiredError";
  }
}

type Cookie = { name: string; value: string; domain?: string };

async function cookieHeader(): Promise<string> {
  const row = await prisma.scraperSession.findUnique({ where: { portal: GESTION_PORTAL } });
  if (!row || !row.valid) throw new GestionSessionExpiredError();
  const state = row.storageState as unknown as { cookies?: Cookie[] };
  const cookies = (state.cookies ?? []).filter((c) => (c.domain ?? "").includes("argenprop"));
  if (!cookies.length) throw new GestionSessionExpiredError();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function markInvalid(): Promise<void> {
  await prisma.scraperSession
    .update({ where: { portal: GESTION_PORTAL }, data: { valid: false } })
    .catch(() => {});
}

export async function markGestionOk(): Promise<void> {
  await prisma.scraperSession
    .update({ where: { portal: GESTION_PORTAL }, data: { lastOkAt: new Date() } })
    .catch(() => {});
}

export type GestionResponse = { status: number; location: string | null; text: string };

function baseHeaders(cookie: string): Record<string, string> {
  return {
    cookie,
    "user-agent": UA,
    origin: BASE,
    referer: `${BASE}/`,
    "accept-language": "es-AR",
  };
}

/** Si el redirect apunta al login, la sesión venció. */
function assertNotLoginRedirect(location: string | null): void {
  if (location && /login|auth|account\/login/i.test(location)) {
    void markInvalid();
    throw new GestionSessionExpiredError();
  }
}

/** POST form-urlencoded. Devuelve status + Location (302) sin seguir el redirect. */
export async function gestionPostForm(
  path: string,
  pairs: [string, string][]
): Promise<GestionResponse> {
  const cookie = await cookieHeader();
  const body = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: { ...baseHeaders(cookie), "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const location = res.headers.get("location");
  assertNotLoginRedirect(location);
  return { status: res.status, location, text: await res.text().catch(() => "") };
}

/** POST con cuerpo JSON (ej: GetPreSignedUrl). Devuelve JSON parseado. */
export async function gestionPostJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const cookie = await cookieHeader();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: { ...baseHeaders(cookie), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  assertNotLoginRedirect(res.headers.get("location"));
  if (res.status >= 400) throw new Error(`Gestión POST ${path} → ${res.status}`);
  return JSON.parse(await res.text()) as T;
}

/** GET (para datos de referencia: provincias, partidos, coordenadas...). */
export async function gestionGetJson<T = unknown>(path: string): Promise<T> {
  const cookie = await cookieHeader();
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    redirect: "manual",
    headers: { ...baseHeaders(cookie), accept: "application/json, text/plain, */*" },
  });
  const location = res.headers.get("location");
  assertNotLoginRedirect(location);
  if (res.status >= 400) throw new Error(`Gestión GET ${path} → ${res.status}`);
  return JSON.parse(await res.text()) as T;
}
