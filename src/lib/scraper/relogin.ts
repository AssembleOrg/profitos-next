/**
 * Re-login REMOTO: el cliente arregla una sesión vencida desde la web, sin
 * terminal ni intervención nuestra.
 *
 * Idea: la sesión (cookies) tiene que generarse en el MISMO navegador+IP que usa
 * el scraper (Cloudflare ata `cf_clearance` a IP+navegador). Por eso el login lo
 * hace el WORKER: abre Brave headful sobre la pantalla virtual Xvfb (:99),
 * arranca un servidor VNC (x11vnc) apuntando a ese display, y la web transmite
 * esa pantalla vía noVNC. El cliente se loguea a mano (incluye captcha), y al
 * terminar guardamos el storageState en la DB.
 *
 * Sólo puede haber UNA sesión de login activa a la vez (comparten el display y
 * el puerto VNC). Auto-expira para no dejar el navegador abierto colgado.
 */
import { chromium as chromiumExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma/client";
import { proxyForPortal, proxyPool, gotoPassingCloudflare, type Portal, type ProxyConfig } from "@/lib/scraper/session";

chromiumExtra.use(StealthPlugin());

// Puerto donde x11vnc expone el framebuffer (sólo local; el bridge WS del worker
// es lo único que se conecta). El display Xvfb lo fija el contenedor (:99).
const VNC_PORT = Number(process.env.RELOGIN_VNC_PORT ?? 5900);
const DISPLAY = process.env.DISPLAY ?? ":99";
const SESSION_TTL_MS = Number(process.env.RELOGIN_TTL_MS ?? 8 * 60_000); // 8 min

/** URL de arranque por portal (si no hay sesión, redirige al login del portal). */
const LOGIN_URL: Record<string, string> = {
  zonaprop: "https://www.zonaprop.com.ar/panel/interesados",
  argenprop: "https://www.argenprop.com/micuenta/mismensajes",
  "argenprop-gestion": "https://gestion.argenprop.com/",
};

export function isReloginPortal(p: string): boolean {
  return p in LOGIN_URL;
}

type ReloginSession = {
  id: string;
  portal: string;
  context: BrowserContext;
  dir: string;
  vnc: ChildProcess;
  createdAt: number;
  timer: NodeJS.Timeout;
};

let active: ReloginSession | null = null;

/** ¿Hay un login remoto en curso? El loop del scraper lo usa para no chocar. */
export function isReloginActive(): boolean {
  return active !== null;
}

function newId(): string {
  return `rl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function teardown(): Promise<void> {
  const s = active;
  active = null;
  if (!s) return;
  clearTimeout(s.timer);
  try {
    s.vnc.kill("SIGKILL");
  } catch {
    /* noop */
  }
  await s.context.close().catch(() => {});
  fs.rmSync(s.dir, { recursive: true, force: true });
}

/** Lanza x11vnc contra el display Xvfb. -localhost: sólo acepta el bridge local. */
function startVnc(): ChildProcess {
  const proc = spawn(
    "x11vnc",
    [
      "-display", DISPLAY,
      "-rfbport", String(VNC_PORT),
      "-localhost",   // sólo conexiones desde el propio host (nuestro bridge WS)
      "-nopw",        // el gate real es el token HMAC del bridge WS
      "-forever",     // no morir al desconectarse el primer cliente
      "-shared",
      "-noxdamage",
      "-quiet",
    ],
    { stdio: "ignore" }
  );
  return proc;
}

/**
 * Proxy para el re-login: FIJO, no rotativo. Cloudflare mete un challenge
 * interactivo (checkbox) que entra en loop si la IP está fichada; para loguearse
 * hay que usar una IP buena y estable. Prioridad: RELOGIN_PROXY explícito →
 * primera IP del pool → proxy genérico del portal.
 */
function reloginProxy(portal: string): ProxyConfig | undefined {
  const explicit = process.env.RELOGIN_PROXY?.trim();
  if (explicit) {
    try {
      const u = new URL(/^\w+:\/\//.test(explicit) ? explicit : `http://${explicit}`);
      return {
        server: `${u.protocol}//${u.host}`,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
      };
    } catch {
      /* mal formado → sigue */
    }
  }
  const pool = proxyPool();
  if (pool.length) return pool[0]; // fija: primera IP del pool (estable)
  return proxyForPortal(portal as Portal);
}

/** Abre Brave headful sobre Xvfb, apuntando al login del portal. */
async function launchInteractive(portal: string, dir: string): Promise<BrowserContext> {
  const proxy = reloginProxy(portal);
  const context = await chromiumExtra.launchPersistentContext(dir, {
    headless: false, // headful: se ve en la pantalla Xvfb que transmite el VNC
    executablePath: process.env.SCRAPER_CHROME_PATH?.trim() || undefined,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-position=0,0",
      "--window-size=1280,1024",
      "--start-maximized",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    viewport: null,
    ...(proxy ? { proxy } : {}),
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await gotoPassingCloudflare(page, LOGIN_URL[portal]).catch(() => {});
  return context;
}

export type StartResult = { sessionId: string; portal: string; ttlMs: number };

/**
 * Arranca una sesión de login remoto. Si ya había una, la cierra primero.
 * Devuelve el id de sesión (la web abre el visor noVNC contra el worker).
 */
export async function startReloginSession(portal: string): Promise<StartResult> {
  if (!isReloginPortal(portal)) throw new Error(`Portal no soportado para re-login: ${portal}`);
  await teardown(); // una sola sesión a la vez

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `relogin-${portal}-`));
  const vnc = startVnc();
  const context = await launchInteractive(portal, dir);

  const createdAt = Date.now();
  const session: ReloginSession = {
    id: "",
    portal,
    context,
    dir,
    vnc,
    createdAt,
    timer: setTimeout(() => void teardown(), SESSION_TTL_MS),
  };
  session.id = newId();
  active = session;
  return { sessionId: session.id, portal, ttlMs: SESSION_TTL_MS };
}

export type FinishResult = { ok: boolean; loggedIn: boolean; message: string };

/**
 * Cierra la sesión: valida que la cuenta quedó logueada (recarga el portal y
 * chequea que no redirija al login) y, si sí, guarda el storageState en la DB.
 */
export async function finishReloginSession(sessionId: string): Promise<FinishResult> {
  const s = active;
  if (!s || s.id !== sessionId) {
    return { ok: false, loggedIn: false, message: "No hay sesión de login activa (o expiró)." };
  }
  const portal = s.portal;
  try {
    const page = s.context.pages()[0] ?? (await s.context.newPage());
    const { ok: cfOk } = await gotoPassingCloudflare(page, LOGIN_URL[portal]);
    const url = page.url();
    const stillLogin = /login|signin|ingresar|acceder/i.test(url);
    if (!cfOk || stillLogin) {
      return {
        ok: false,
        loggedIn: false,
        message: stillLogin
          ? "Todavía no estás logueado (la página sigue en el login). Completá el login y reintentá."
          : "Cloudflare no resolvió; reintentá en unos segundos.",
      };
    }
    const state = await s.context.storageState();
    await prisma.scraperSession.upsert({
      where: { portal },
      create: { portal, storageState: state as object, valid: true, lastOkAt: new Date() },
      update: { storageState: state as object, valid: true, lastOkAt: new Date() },
    });
    return { ok: true, loggedIn: true, message: `Sesión de ${portal} guardada. Conexión restablecida.` };
  } finally {
    await teardown();
  }
}

/** Cancela la sesión activa sin guardar (botón "cancelar" o cierre de modal). */
export async function cancelReloginSession(): Promise<void> {
  await teardown();
}

export { VNC_PORT };
