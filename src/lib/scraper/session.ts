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
 * Útil para leer cookies sin abrir navegador.
 */
export async function getStoredCookie(portal: Portal, name: string): Promise<string | null> {
  const state = await loadStorageState(portal);
  if (!state) return null;
  return state.cookies?.find((c) => c.name === name)?.value ?? null;
}

export type ProxyConfig = { server: string; username?: string; password?: string };

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

/** Proxy: `<PORTAL>_PROXY` o el genérico PROXY_SERVER / USER / PASS. */
export function proxyForPortal(portal: Portal): ProxyConfig | undefined {
  const named = parseProxy(process.env[`${portal.toUpperCase()}_PROXY`]);
  if (named) return named;
  const server = process.env.PROXY_SERVER?.trim();
  if (!server) return undefined;
  return {
    server,
    username: process.env.PROXY_USER?.trim() || undefined,
    password: process.env.PROXY_PASS?.trim() || undefined,
  };
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
  // Chrome real pasa el anti-bot de Cloudflare; el chromium bundle no. En local
  // sin Google Chrome instalado, apuntar a un Chromium real (ej: Brave) con
  // SCRAPER_CHROME_PATH. Si no está, se intenta el canal "chrome" del sistema.
  const execPath = process.env.SCRAPER_CHROME_PATH?.trim();
  if (execPath) {
    return await chromiumExtra.launchPersistentContext(userDataDir, { ...opts, executablePath: execPath });
  }
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

function looksLikeCloudflare(title: string, url = "", body = ""): boolean {
  return /just a moment|un momento|cf-|challenge|verify you are human|verifica que eres/i.test(
    `${title} ${url} ${body}`
  );
}

/** Espera a que Cloudflare termine el challenge JS. Devuelve false si no pasó.
 *  Paciente (90s por defecto): algunos challenges "managed" tardan bastante. */
export async function waitForCloudflare(page: Page, timeoutMs = 90_000): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (!looksLikeCloudflare(title, page.url())) return true;
  await page
    .waitForFunction(() => !/just a moment|un momento/i.test(document.title), { timeout: timeoutMs })
    .catch(() => {});
  await page.waitForTimeout(3000);
  const after = await page.title().catch(() => "");
  return !looksLikeCloudflare(after, page.url());
}

/**
 * Navega a `url` reintentando el challenge de Cloudflare con backoff. Un desafío
 * transitorio suele pasar al 2º intento; una IP FICHADA falla en todos (ahí el
 * fix es otra IP/esperar, no reintentar). Devuelve la última respuesta y si pasó.
 */
export async function gotoPassingCloudflare(
  page: Page,
  url: string,
  attempts = 3
): Promise<{ ok: boolean; response: Awaited<ReturnType<Page["goto"]>> }> {
  let response: Awaited<ReturnType<Page["goto"]>> = null;
  for (let i = 0; i < attempts; i++) {
    response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => null);
    if (await waitForCloudflare(page)) return { ok: true, response };
    if (i < attempts - 1) await page.waitForTimeout(3000 + i * 4000); // backoff antes de reintentar
  }
  return { ok: false, response };
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
    const origins = (state as { origins?: { origin: string; localStorage?: { name: string; value: string }[] }[] })
      .origins ?? [];
    if (origins.length) {
      await context.addInitScript((entries) => {
        try {
          const match = entries.find(
            (o) => location.origin === o.origin || location.href.startsWith(o.origin)
          );
          if (!match?.localStorage) return;
          for (const { name, value } of match.localStorage) localStorage.setItem(name, value);
        } catch {
          /* noop */
        }
      }, origins);
    }

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
    const { ok: cfOk, response: resp } = await gotoPassingCloudflare(page, bootstrapUrl);
    if (!cfOk) {
      throw new Error(`Cloudflare no resolvió el challenge en ${portal} (${page.url()})`);
    }

    if (resp && resp.status() === 401) {
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
