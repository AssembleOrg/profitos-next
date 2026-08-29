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
import {
  createFullDraft,
  publishHeaders,
  setMultimedia,
  selectPlan,
  type DraftInput,
  type StepResult,
  type StepRunner,
} from "./publish";

const PORTAL: Portal = "zonaprop";
const BASE = "https://www.zonaprop.com.ar";
const PANEL = `${BASE}/panel/publicador-profesionales/main`;
const PUB_API = `${BASE}/reppro-api/publication/api/v1`;

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
 * Abre un navegador con la sesión guardada, pasa Cloudflare, navega el panel y
 * ejecuta `fn` con la página logueada y el sessionId. Limpia el perfil al salir.
 */
async function withPublishPage<T>(fn: (page: Page, sessionId: string) => Promise<T>): Promise<T> {
  const state = (await loadStorageState(PORTAL)) as unknown as StorageState | null;
  if (!state) throw new SessionExpiredError(PORTAL);

  const cookies = state.cookies ?? [];
  const sessionId =
    (cookies as { name: string; value: string }[]).find((c) => c.name === "sessionId")?.value ?? "";
  const lsEntries: [string, string][] =
    state.origins?.find((o) => o.origin.includes("zonaprop"))?.localStorage?.map((e) => [e.name, e.value]) ?? [];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zpublish-"));
  const context = await launch(dir);
  try {
    await context.addInitScript((entries: [string, string][]) => {
      try {
        if (location.hostname.endsWith("zonaprop.com.ar")) for (const [k, v] of entries) localStorage.setItem(k, v);
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
    if (!cfOk) throw new Error(`Cloudflare no resolvió el challenge en zonaprop (${page.url()})`);
    if (resp && resp.status() === 401) {
      await markSessionInvalid(PORTAL);
      throw new SessionExpiredError(PORTAL);
    }
    if (/login|signin|ingresar|acceder/i.test(page.url())) {
      await markSessionInvalid(PORTAL);
      throw new SessionExpiredError(PORTAL);
    }
    return await fn(page, sessionId);
  } finally {
    await context.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** GET dentro de la página logueada (datos de referencia: geopoint, créditos). */
async function getInPage<T>(page: Page, sessionId: string, url: string): Promise<T> {
  const headers = publishHeaders(sessionId);
  const res = await page.evaluate(
    async ({ url, headers }) => {
      const r = await fetch(url, { method: "GET", credentials: "include", headers });
      return { status: r.status, text: await r.text() };
    },
    { url, headers }
  );
  if (res.status === 401 || res.status === 403) {
    await markSessionInvalid(PORTAL);
    throw new SessionExpiredError(PORTAL);
  }
  if (res.status >= 400) throw new Error(`ZonaProp GET ${res.status} en ${url}: ${res.text.slice(0, 150)}`);
  return JSON.parse(res.text) as T;
}

/** Sube una foto a /reipro-api/preview: baja los bytes en Node y hace el POST
 *  multipart DENTRO de la página (mismo origen → cookies). Devuelve temporalUrl. */
async function uploadPhoto(
  page: Page,
  sessionId: string,
  postingId: string,
  bytesB64: string,
  filename: string
): Promise<{ temporalUrl: string; fullName: string; id?: string }> {
  const url = `${BASE}/reipro-api/preview?postingId=${postingId}`;
  const headers = { sessionid: sessionId, "x-panel-portal": "ZPAR" };
  const res = await page.evaluate(
    async ({ url, headers, b64, filename }) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const fd = new FormData();
      fd.append("file", new Blob([arr]), filename);
      const r = await fetch(url, { method: "POST", credentials: "include", headers, body: fd });
      return { status: r.status, text: await r.text() };
    },
    { url, headers, b64: bytesB64, filename }
  );
  if (res.status >= 400) throw new Error(`ZonaProp foto ${res.status}: ${res.text.slice(0, 120)}`);
  return JSON.parse(res.text) as { temporalUrl: string; fullName: string; id?: string };
}

/** Resuelve el location_id de ZonaProp desde coordenadas (GET geopoint). */
async function resolveLocationByCoords(
  page: Page,
  sessionId: string,
  lat: number,
  lng: number
): Promise<{ locationId: string; postalCode?: string } | null> {
  try {
    const r = await getInPage<{ location_id?: string; id?: string; locationId?: string; postal_code?: string }>(
      page,
      sessionId,
      `${PUB_API}/location/geopoint?lat=${lat}&lng=${lng}`
    );
    const id = r.location_id ?? r.locationId ?? r.id;
    return id ? { locationId: id, postalCode: r.postal_code } : null;
  } catch {
    return null;
  }
}

/**
 * Crea un BORRADOR en ZonaProp (sin fotos ni activación). Devuelve el postingId.
 * Lanza SessionExpiredError si la sesión venció (re-logueá con login.ts).
 */
export async function publishDraftViaBrowser(input: DraftInput): Promise<string> {
  return withPublishPage((page, sessionId) => createFullDraft(makeRunner(page, sessionId), input));
}

export type PhotoSource = { url: string };
export type FullPublishInput = {
  draft: DraftInput;
  /** Coordenadas para resolver ubicación (STEP_LOCATION) si el draft no la trae. */
  coords?: { lat: number; lng: number; address: string };
  photos?: PhotoSource[];
  responsibleUserId?: string;
  /** Si viene, PUBLICA (STEP_PLAN_SELECTION) → gasta 1 crédito del plan. */
  activate?: { publicationPlan: string };
};
export type FullPublishResult = { postingId: string; status: string; published: boolean; permalink: string };

/**
 * Publica una propiedad en ZonaProp: crea el aviso, sube fotos, setea responsable
 * y —si `activate`— lo pone ONLINE (gasta crédito). Sin `activate` queda DRAFT.
 */
export async function publishViaBrowser(input: FullPublishInput): Promise<FullPublishResult> {
  return withPublishPage(async (page, sessionId) => {
    const run = makeRunner(page, sessionId);

    // Ubicación: resolver location_id desde coords si el draft no la trae.
    const draft: DraftInput = { ...input.draft };
    if (!draft.location && input.coords) {
      const loc = await resolveLocationByCoords(page, sessionId, input.coords.lat, input.coords.lng);
      if (loc) {
        draft.location = {
          address: input.coords.address,
          coordinates: [input.coords.lng, input.coords.lat],
          locationId: loc.locationId,
          visibility: "EXACT",
        };
      }
    }

    // Pasos 1-6 (operación, ubicación, descripción, main, precio).
    const postingId = await createFullDraft(run, draft);

    // Paso 7: fotos (baja bytes en Node → sube multipart in-page → adjunta).
    if (input.photos?.length) {
      const pics: { temporalUrl: string; fullName: string; id?: string | null; order: number }[] = [];
      let order = 1;
      for (const ph of input.photos.slice(0, 20)) {
        try {
          const b = await fetch(ph.url);
          if (!b.ok) continue;
          const buf = Buffer.from(await b.arrayBuffer());
          const name = ph.url.split("/").pop()?.split("?")[0] || `foto${order}.jpg`;
          const up = await uploadPhoto(page, sessionId, postingId, buf.toString("base64"), name);
          pics.push({ temporalUrl: up.temporalUrl, fullName: up.fullName, id: up.id ?? null, order });
          order++;
        } catch {
          /* saltar foto que falle */
        }
      }
      if (pics.length) await setMultimedia(run, postingId, pics);
    }

    // Responsable (quién recibe las consultas).
    if (input.responsibleUserId) {
      const url = `${PUB_API}/posting/updatePostingResponsible?postingId=${postingId}&userId=${input.responsibleUserId}`;
      const headers = { sessionid: sessionId, "x-panel-portal": "ZPAR" };
      await page
        .evaluate(async ({ url, headers }) => {
          await fetch(url, { method: "PUT", credentials: "include", headers });
        }, { url, headers })
        .catch(() => {});
    }

    // Paso 8: activar (gasta crédito). Solo si viene `activate`.
    let final: StepResult = { postingId, status: "DRAFT", postingPublished: false };
    if (input.activate) final = await selectPlan(run, postingId, input.activate.publicationPlan);

    return {
      postingId,
      status: final.status,
      published: final.postingPublished,
      permalink: `${BASE}/panel/publicador-profesionales/edition?postingId=${postingId}`,
    };
  });
}
