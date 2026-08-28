/**
 * DESCUBRIMIENTO del flujo de PUBLICAR en ArgenProp Gestión (uso único).
 *
 * Abre un Chrome real, te logueás a mano, y capturás TODO el tráfico de API
 * (request + response, con payloads) mientras creás una propiedad de prueba con
 * "Añadir Propiedad". Dejala como "No publicar en internet" para no publicarla.
 *
 * Uso (en TU terminal, NO en background):
 *   pnpm exec tsx scripts/scraper/discover-argenprop-publish.ts
 *
 * Si la URL inicial no es la correcta, navegá a ArgenProp Gestión a mano en la
 * ventana. Después pasame el archivo publish-network.jsonl (lo borramos al fin).
 */
import "dotenv/config";
import { chromium, type BrowserContext } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "C:/Users/Aaron/AppData/Local/Temp/argenprop-publish-discovery";
const START_URL = process.env.ARGENPROP_GESTION_URL ?? "https://gestion.argenprop.com";

// Capturamos todo lo que parezca API: no-GET (crear/guardar) o xhr/fetch JSON.
// Excluimos ruido de analytics/tracking.
const NOISE = /google|gstatic|doubleclick|collect|measurement|analytics|gtm|facebook|hotjar|newrelic|nr-data|sentry|cloudflare|recaptcha|osm|tile|openstreetmap/i;
function interesting(method: string, rt: string, url: string): boolean {
  if (NOISE.test(url)) return false;
  if (method !== "GET") return true;
  return rt === "xhr" || rt === "fetch";
}

const SENSITIVE = new Set(["cookie", "authorization", "x-csrf-token", "x-xsrf-token"]);
function safeHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    const key = k.toLowerCase();
    out[key] = SENSITIVE.has(key) ? "[REDACTED]" : v;
  }
  return out;
}

async function launch(userDataDir: string): Promise<BrowserContext> {
  const common = {
    headless: false,
    viewport: null,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  try {
    return await chromium.launchPersistentContext(userDataDir, { ...common, channel: "chrome" });
  } catch {
    return await chromium.launchPersistentContext(userDataDir, common);
  }
}

type Capture = { netPath: string; marker: (label: string) => void };
function attachCapture(context: BrowserContext): Capture {
  const netPath = path.join(OUT_DIR, "publish-network.jsonl");
  fs.writeFileSync(netPath, "");
  let n = 0;
  const write = (o: object) => fs.appendFileSync(netPath, JSON.stringify(o) + "\n");
  const marker = (label: string) => write({ phase: "marker", t: new Date().toISOString(), label });

  context.on("request", (req) => {
    const method = req.method();
    const url = req.url();
    const rt = req.resourceType();
    if (!interesting(method, rt, url)) return;
    let postData = "";
    try {
      postData = req.postData() ?? "";
    } catch {
      postData = "[binary/multipart]";
    }
    if (postData.length > 30_000) postData = postData.slice(0, 30_000) + "...[TRUNC]";
    n += 1;
    write({ n, phase: "req", t: new Date().toISOString(), method, url, resourceType: rt, headers: safeHeaders(req.headers()), postData });
  });

  context.on("response", async (res) => {
    const req = res.request();
    const method = req.method();
    const url = res.url();
    const rt = req.resourceType();
    if (!interesting(method, rt, url)) return;
    const ct = res.headers()["content-type"] ?? "";
    let body = "";
    if (ct.includes("json") || ct.includes("text")) {
      try {
        body = await res.text();
      } catch {
        body = "";
      }
      if (body.length > 200_000) body = body.slice(0, 200_000) + "...[TRUNC]";
    }
    n += 1;
    write({ n, phase: "res", t: new Date().toISOString(), status: res.status(), method, url, contentType: ct, body });
  });

  return { netPath, marker };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rl = readline.createInterface({ input, output });

  const userDataDir = path.join(OUT_DIR, "userdata");
  const context = await launch(userDataDir);
  const { netPath, marker } = attachCapture(context);
  console.log(`  → Capturando API (req+res) en: ${netPath}`);

  const page = context.pages()[0] ?? (await context.newPage());
  console.log(`\nAbriendo ${START_URL} ...`);
  await page.goto(START_URL, { waitUntil: "domcontentloaded" }).catch(() => {});

  await rl.question(
    `\n[1] Logueate en ArgenProp Gestión (si la URL no es esa, navegá a mano).\n` +
      `    Cuando estés DENTRO del CRM, apretá Enter... `
  );

  marker("A-abrir-form");
  await rl.question(
    `\n[A] Apretá "Añadir Propiedad" y esperá a que cargue el formulario.\n` +
      `    (Captura los GET de datos de referencia: tipos, ubicación...)\n` +
      `    Cuando cargó, apretá Enter... `
  );

  marker("B-datos-inmueble");
  await rl.question(
    `\n[B] Completá "Datos del inmueble" (tipo, operación, precio, ubicación,\n` +
      `    ambientes, superficies) y apretá CONTINUAR (o GUARDAR Y SALIR).\n` +
      `    (Captura el POST de guardar los datos del inmueble.) Enter... `
  );

  marker("C-datos-contacto");
  await rl.question(
    `\n[C] Completá "Datos de contacto" y apretá CONTINUAR. Enter... `
  );

  marker("D-publicacion-no-publicar");
  await rl.question(
    `\n[D] En "Publicación", TILDÁ "No publicar en internet" y GUARDÁ.\n` +
      `    (Así queda como propiedad NO publicada — sin salir pública.)\n` +
      `    (Captura el POST final de guardar/estado.) Enter... `
  );

  marker("fin");
  console.log(`\n  ✔ Captura en:\n    ${netPath}`);
  console.log(`  ✔ Podés borrar la propiedad de prueba desde el CRM.`);
  console.log(`  ✔ Pasame el archivo (o los requests de los pasos B y D).`);

  await rl.question(`\nEnter para cerrar el navegador... `);
  rl.close();
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
