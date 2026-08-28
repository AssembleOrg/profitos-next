import { chromium as chromiumExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext, Page } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma/client";

// playwright-extra + stealth: agrega evasiones anti-bot por encima de las
// manuales (oculta más señales de automatización que delatan al navegador).
chromiumExtra.use(StealthPlugin());

export type Portal = "zonaprop" | "argenprop";

/** Se lanza cuando la sesión guardada no existe o venció (hay que re-loguear). */
export class SessionExpiredError extends Error {
  constructor(public readonly portal: Portal) {
    super(`Sesión de ${portal} expirada o inexistente. Re-logueá con el script de login.`);
    this.name = "SessionExpiredError";
  }
}

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
];

function headless(): boolean {
  // En Railway suele no haber display; default headless. Override con env.
  return process.env.SCRAPER_HEADLESS !== "false";
}

export async function loadStorageState(portal: Portal): Promise<StorageState | null> {
  const row = await prisma.scraperSession.findUnique({ where: { portal } });
  if (!row || !row.valid) return null;
  return row.storageState as unknown as StorageState;
}

export async function saveStorageState(portal: Portal, state: StorageState): Promise<void> {
  await prisma.scraperSession.upsert({
    where: { portal },
    create: { portal, storageState: state as object, valid: true, lastOkAt: new Date() },
    update: { storageState: state as object, valid: true, lastOkAt: new Date() },
  });
}

export async function markSessionInvalid(portal: Portal): Promise<void> {
  await prisma.scraperSession
    .update({ where: { portal }, data: { valid: false } })
    .catch(() => {});
}

/** Marca la sesión como sana (actualiza lastOkAt) sin abrir navegador. */
export async function markSessionOk(portal: Portal): Promise<void> {
  await prisma.scraperSession
    .update({ where: { portal }, data: { lastOkAt: new Date() } })
    .catch(() => {});
}

/**
 * Devuelve el valor de una cookie de la sesión GUARDADA en la DB (sin abrir
 * navegador). Respeta el flag `valid`: si la sesión venció, devuelve null.
 * Lo usa el transporte por ZenRows, que no tiene un contexto de browser vivo.
 */
export async function getStoredCookie(portal: Portal, name: string): Promise<string | null> {
  const state = await loadStorageState(portal);
  if (!state) return null;
  return state.cookies?.find((c) => c.name === name)?.value ?? null;
}

type ProxyConfig = { server: string; username?: string; password?: string };

/** Parsea una URL de proxy (http://user:pass@host:port) al formato de Playwright. */
function parseProxy(url: string | undefined): ProxyConfig | undefined {
  if (!url?.trim()) return undefined;
  try {
    const u = new URL(url.trim());
    return {
      server: `${u.protocol}//${u.host}`,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return undefined;
  }
}

/** Proxy configurado para un portal, vía env `<PORTAL>_PROXY` (ej: ZONAPROP_PROXY). */
function proxyForPortal(portal: Portal): ProxyConfig | undefined {
  return parseProxy(process.env[`${portal.toUpperCase()}_PROXY`]);
}

/**
 * Lanza un CONTEXTO PERSISTENTE (perfil en disco). Es lo que convence al
 * anti-bot de Cloudflare (un `newContext` efímero recibe 403 "Just a moment").
 * ignoreDefaultArgs quita "--enable-automation" (otra señal que delata al bot).
 */
async function launchPersistent(userDataDir: string, proxy?: ProxyConfig): Promise<BrowserContext> {
  const opts = {
    headless: headless(),
    args: STEALTH_ARGS,
    ignoreDefaultArgs: ["--enable-automation"],
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    ...(proxy ? { proxy } : {}),
  };
  try {
    return await chromiumExtra.launchPersistentContext(userDataDir, { ...opts, channel: "chrome" });
  } catch {
    return await chromiumExtra.launchPersistentContext(userDataDir, opts);
  }
}

/** Devuelve el valor de una cookie de la sesión actual (o null). */
export async function getCookie(context: BrowserContext, name: string): Promise<string | null> {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === name)?.value ?? null;
}

/**
 * Abre un contexto persistente con las cookies de la sesión guardada, navega a
 * `bootstrapUrl` (pasa el anti-bot y calienta la sesión) y ejecuta `fn`.
 * Limpia el perfil temporal al terminar y refresca las cookies en DB.
 */
export async function withPortalPage<T>(
  portal: Portal,
  bootstrapUrl: string,
  fn: (page: Page, context: BrowserContext) => Promise<T>
): Promise<T> {
  const state = await loadStorageState(portal);
  if (!state) throw new SessionExpiredError(portal);

  const proxy = proxyForPortal(portal);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `scraper-${portal}-`));
  const context = await launchPersistent(dir, proxy);
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Con proxy (se paga por tráfico), bloqueamos recursos pesados que no
    // necesitamos (imágenes/media/fuentes). No afecta el challenge JS ni la API.
    if (proxy) {
      await context.route("**/*", (route) => {
        const t = route.request().resourceType();
        if (t === "image" || t === "media" || t === "font") return route.abort();
        return route.continue();
      });
    }

    if (state.cookies?.length) await context.addCookies(state.cookies);

    const page = context.pages()[0] ?? (await context.newPage());
    const resp = await page.goto(bootstrapUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });

    if (resp && (resp.status() === 401 || resp.status() === 403)) {
      await markSessionInvalid(portal);
      throw new SessionExpiredError(portal);
    }
    if (/login|signin|ingresar|acceder/i.test(page.url())) {
      await markSessionInvalid(portal);
      throw new SessionExpiredError(portal);
    }

    const result = await fn(page, context);

    await saveStorageState(portal, await context.storageState());
    return result;
  } finally {
    await context.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Hace un fetch DENTRO de la página (mismo origen → manda cookies y pasa el
 * anti-bot). Devuelve JSON parseado. Lanza SessionExpiredError ante 401/403.
 */
export async function fetchJsonInPage<T = unknown>(
  page: Page,
  url: string,
  portal: Portal,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const res = await page.evaluate(
    async ({ u, headers }) => {
      const r = await fetch(u, {
        credentials: "include",
        headers: { accept: "application/json", ...headers },
      });
      const text = await r.text();
      return { status: r.status, text };
    },
    { u: url, headers: extraHeaders }
  );

  if (res.status === 401 || res.status === 403) {
    await markSessionInvalid(portal);
    throw new SessionExpiredError(portal);
  }
  if (res.status >= 400) {
    throw new Error(`Fetch ${url} devolvió ${res.status}`);
  }
  return JSON.parse(res.text) as T;
}

// ─── Transporte por ZenRows (API de scraping con bypass de Cloudflare) ───────
//
// ZonaProp bloquea la IP de datacenter de Railway. En vez de manejar un
// navegador, delegamos el bypass a ZenRows: le pasamos la URL de la API interna
// de ZonaProp y nuestros headers de auth (sessionid + cookie), y ZenRows
// resuelve el challenge y nos devuelve el JSON. El sessionId autentica sin
// importar la IP (probado), así que no necesitamos navegador para ZonaProp.

const ZENROWS_ENDPOINT = "https://api.zenrows.com/v1/";
const ZENROWS_PROXY_COUNTRY = process.env.ZENROWS_PROXY_COUNTRY ?? "ar";

function zenrowsKey(): string {
  const k = process.env.ZENROWS_API_KEY?.trim();
  if (!k) throw new Error("Falta ZENROWS_API_KEY en el entorno.");
  return k;
}

/** Parseo tolerante: con js_render el JSON puede venir crudo o dentro de HTML. */
function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error(`Respuesta de ZenRows no es JSON: ${text.slice(0, 200)}`);
  }
}

/**
 * GET a una API interna del portal a través de ZenRows. Reenvía `headers` al
 * target (custom_headers=true). Reintenta ante fallos transitorios de ZenRows
 * (422 render / 429 rate / 5xx). Lanza SessionExpiredError si el target
 * responde 401/403 (sesión vencida).
 */
export async function fetchJsonViaZenrows<T = unknown>(
  targetUrl: string,
  portal: Portal,
  headers: Record<string, string> = {},
  attempts = 2
): Promise<T> {
  let lastErr: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    const params = new URLSearchParams({
      url: targetUrl,
      apikey: zenrowsKey(),
      js_render: "true", // resuelve el challenge JS de Cloudflare
      premium_proxy: "true", // IP residencial
      proxy_country: ZENROWS_PROXY_COUNTRY,
      custom_headers: "true", // reenvía nuestros headers de auth al target
    });

    const res = await fetch(`${ZENROWS_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: { accept: "application/json", ...headers },
    });
    const text = await res.text();
    const contentType = res.headers.get("content-type") ?? "";

    // Error propio de ZenRows (créditos, rate limit, render fallido).
    if (contentType.includes("problem+json")) {
      lastErr = new Error(`ZenRows ${res.status}: ${text.slice(0, 200)}`);
      if (res.status === 422 || res.status === 429 || res.status >= 500) continue; // transitorio → reintentar
      throw lastErr;
    }

    // Status del TARGET (ZenRows lo refleja).
    if (res.status === 401 || res.status === 403) {
      await markSessionInvalid(portal);
      throw new SessionExpiredError(portal);
    }
    if (res.status >= 400) {
      throw new Error(`Target ${res.status} en ${targetUrl}: ${text.slice(0, 200)}`);
    }
    return parseJsonLoose(text) as T;
  }

  throw lastErr ?? new Error("ZenRows: sin respuesta tras reintentos.");
}
