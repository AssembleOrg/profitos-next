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

/**
 * Lanza un CONTEXTO PERSISTENTE (perfil en disco). Es lo que convence al
 * anti-bot de Cloudflare (un `newContext` efímero recibe 403 "Just a moment").
 * ignoreDefaultArgs quita "--enable-automation" (otra señal que delata al bot).
 */
async function launchPersistent(userDataDir: string): Promise<BrowserContext> {
  const opts = {
    headless: headless(),
    args: STEALTH_ARGS,
    ignoreDefaultArgs: ["--enable-automation"],
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
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

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `scraper-${portal}-`));
  const context = await launchPersistent(dir);
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
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
