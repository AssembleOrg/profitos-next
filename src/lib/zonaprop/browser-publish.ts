/**
 * Transporte de PUBLICACIÓN: navegador real con la sesión logueada.
 *
 * Por qué un navegador y no ZenRows: la escritura en ZonaProp exige el estado
 * de una sesión logueada real (cookies + localStorage + fingerprint del panel).
 * ZenRows (stateless) devuelve 401/403 en la creación (probado). Ver
 * docs/ZONAPROP-PUBLISH.md. Acá abrimos un Chrome con la sesión guardada,
 * navegamos el panel (pasa Cloudflare) y hacemos cada STEP_* con fetch DENTRO
 * de la página (mismo origen → manda cookies, Origin y estado de sesión).
 *
 * IP: en Railway (datacenter) Cloudflare bloquea la navegación inicial, así que
 * en producción hay que salir por IP residencial (env ZONAPROP_PROXY) o correr
 * desde una máquina residencial. Local (IP de casa) funciona sin proxy.
 */
import { chromium as chromiumExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext, Page } from "playwright";

chromiumExtra.use(StealthPlugin());
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadStorageState,
  markSessionInvalid,
  SessionExpiredError,
  gotoPassingCloudflare,
  type Portal,
} from "@/lib/scraper/session";
import { createFullDraft, publishHeaders, type DraftInput, type StepResult, type StepRunner } from "./publish";

const PORTAL: Portal = "zonaprop";
const BASE = "https://www.zonaprop.com.ar";
const PANEL = `${BASE}/panel/publicador-profesionales/main`;

const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
];

function headless(): boolean {
  return process.env.SCRAPER_HEADLESS !== "false";
}

/**
 * Proxy residencial para publicar. Acepta dos formatos:
 *  - ZONAPROP_PROXY=http://user:pass@host:port  (combinado), o
 *  - PROXY_SERVER / PROXY_USER / PROXY_PASS      (separado).
 */
function proxy(): { server: string; username?: string; password?: string } | undefined {
  const url = process.env.ZONAPROP_PROXY?.trim();
  if (url) {
    try {
      const u = new URL(url);
      return {
        server: `${u.protocol}//${u.host}`,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
      };
    } catch {
      /* cae al formato separado */
    }
  }
  const server = process.env.PROXY_SERVER?.trim();
  if (server) {
    return {
      server,
      username: process.env.PROXY_USER?.trim() || undefined,
      password: process.env.PROXY_PASS?.trim() || undefined,
    };
  }
  return undefined;
}

type StorageState = {
  cookies?: Parameters<BrowserContext["addCookies"]>[0];
  origins?: { origin: string; localStorage?: { name: string; value: string }[] }[];
};

async function launch(userDataDir: string): Promise<BrowserContext> {
  const opts = {
    headless: headless(),
    args: STEALTH_ARGS,
    ignoreDefaultArgs: ["--enable-automation"],
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    ...(proxy() ? { proxy: proxy() } : {}),
  };
  // Brave (SCRAPER_CHROME_PATH) pasa Cloudflare donde el chromium bundle falla.
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

/** Runner que ejecuta cada STEP_* con fetch dentro de la página logueada. */
function makeRunner(page: Page, sessionId: string): StepRunner {
  const headers = publishHeaders(sessionId);
  return async (url, body) => {
    const res = await page.evaluate(
      async ({ url, body, headers }) => {
        const r = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify(body),
        });
        return { status: r.status, text: await r.text() };
      },
      { url, body, headers }
    );
    if (res.status === 401 || res.status === 403) {
      await markSessionInvalid(PORTAL);
      throw new SessionExpiredError(PORTAL);
    }
    if (res.status >= 400) {
      throw new Error(`ZonaProp ${res.status} en ${url}: ${res.text.slice(0, 200)}`);
    }
    return JSON.parse(res.text) as StepResult;
  };
}

/**
 * Crea un BORRADOR en ZonaProp desde la sesión guardada. Devuelve el postingId.
 * No sube fotos ni confirma (queda DRAFT). Lanza SessionExpiredError si la
 * sesión venció (hay que re-loguear con scripts/scraper/login.ts).
 */
export async function publishDraftViaBrowser(input: DraftInput): Promise<string> {
  const state = (await loadStorageState(PORTAL)) as unknown as StorageState | null;
  if (!state) throw new SessionExpiredError(PORTAL);

  const cookies = state.cookies ?? [];
  const sessionId =
    (cookies as { name: string; value: string }[]).find((c) => c.name === "sessionId")?.value ?? "";
  // localStorage del origen de ZonaProp (lo que faltaba: sin esto da "User not Logged").
  const lsEntries: [string, string][] =
    state.origins
      ?.find((o) => o.origin.includes("zonaprop"))
      ?.localStorage?.map((e) => [e.name, e.value]) ?? [];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zpublish-"));
  const context = await launch(dir);
  try {
    // Restaurar localStorage (además de cookies) ANTES de navegar.
    await context.addInitScript((entries: [string, string][]) => {
      try {
        if (location.hostname.endsWith("zonaprop.com.ar")) {
          for (const [k, v] of entries) localStorage.setItem(k, v);
        }
      } catch {
        /* noop */
      }
    }, lsEntries);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    if (cookies.length) await context.addCookies(cookies);

    const page = context.pages()[0] ?? (await context.newPage());
    const { ok: cfOk, response: resp } = await gotoPassingCloudflare(page, PANEL);
    if (!cfOk) {
      throw new Error(`Cloudflare no resolvió el challenge en zonaprop (${page.url()})`);
    }
    if (resp && resp.status() === 401) {
      await markSessionInvalid(PORTAL);
      throw new SessionExpiredError(PORTAL);
    }
    if (/login|signin|ingresar|acceder/i.test(page.url())) {
      await markSessionInvalid(PORTAL);
      throw new SessionExpiredError(PORTAL);
    }

    const run = makeRunner(page, sessionId);
    return await createFullDraft(run, input);
  } finally {
    await context.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
