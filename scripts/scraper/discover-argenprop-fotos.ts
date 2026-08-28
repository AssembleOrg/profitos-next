/**
 * DESCUBRIMIENTO: subida de FOTOS y paso de PUBLICACIÓN en ArgenProp Gestión.
 *
 * Abrí una ficha existente en "Editar", agregá una foto (captura la subida) y
 * andá a "Publicación": tildá "No publicar en internet" y Guardá (captura el
 * endpoint de publicación SIN publicar de verdad).
 *
 *   pnpm exec tsx scripts/scraper/discover-argenprop-fotos.ts
 *
 * Después avisame y leo la captura del disco.
 */
import "dotenv/config";
import { chromium, type BrowserContext } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = "C:/Users/Aaron/AppData/Local/Temp/argenprop-fotos-discovery";
const START_URL = "https://gestion.argenprop.com/propiedades";

const NOISE = /google|gstatic|doubleclick|collect|measurement|analytics|gtm|facebook|hotjar|newrelic|nr-data|sentry|recaptcha|zdassets|zendesk|osm|tile|openstreetmap/i;
function interesting(method: string, rt: string, url: string): boolean {
  if (NOISE.test(url)) return false;
  if (method !== "GET") return true;
  return rt === "xhr" || rt === "fetch";
}

const SENSITIVE = new Set(["cookie", "authorization", "x-csrf-token", "x-xsrf-token"]);
function safeHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = SENSITIVE.has(k.toLowerCase()) ? "[REDACTED]" : v;
  return out;
}

async function launch(dir: string): Promise<BrowserContext> {
  const common = {
    headless: false,
    viewport: null,
    locale: "es-AR",
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  try {
    return await chromium.launchPersistentContext(dir, { ...common, channel: "chrome" });
  } catch {
    return await chromium.launchPersistentContext(dir, common);
  }
}

function attachCapture(context: BrowserContext) {
  const netPath = path.join(OUT_DIR, "fotos-network.jsonl");
  fs.writeFileSync(netPath, "");
  let n = 0;
  const write = (o: object) => fs.appendFileSync(netPath, JSON.stringify(o) + "\n");
  const marker = (label: string) => write({ phase: "marker", t: new Date().toISOString(), label });

  context.on("request", (req) => {
    const method = req.method(), url = req.url(), rt = req.resourceType();
    if (!interesting(method, rt, url)) return;
    let postData = "";
    try {
      postData = req.postData() ?? "";
    } catch {
      postData = "[binary/multipart]";
    }
    if (postData.length > 20_000) postData = postData.slice(0, 20_000) + "...[TRUNC]";
    n += 1;
    write({ n, phase: "req", method, url, resourceType: rt, headers: safeHeaders(req.headers()), postData });
  });
  context.on("response", async (res) => {
    const req = res.request(), method = req.method(), url = res.url(), rt = req.resourceType();
    if (!interesting(method, rt, url)) return;
    const ct = res.headers()["content-type"] ?? "";
    let body = "";
    if (ct.includes("json") || ct.includes("text")) {
      try { body = await res.text(); } catch { body = ""; }
      if (body.length > 100_000) body = body.slice(0, 100_000) + "...[TRUNC]";
    }
    n += 1;
    write({ n, phase: "res", status: res.status(), method, url, contentType: ct, body });
  });

  return { netPath, marker };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rl = readline.createInterface({ input, output });
  const context = await launch(path.join(OUT_DIR, "userdata"));
  const { netPath, marker } = attachCapture(context);
  console.log(`  → Capturando en: ${netPath}`);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(START_URL, { waitUntil: "domcontentloaded" }).catch(() => {});

  await rl.question(`\n[1] Logueate si hace falta y abrí UNA ficha existente en "Editar". Enter... `);

  marker("A-subir-foto");
  await rl.question(
    `\n[A] En "Datos del inmueble", agregá UNA foto (arrastrala o "AGREGAR FOTOS")\n` +
      `    y esperá a que suba. (Captura el endpoint de subida.) Enter... `
  );

  marker("B-publicacion-no-publicar");
  await rl.question(
    `\n[B] Andá a la pestaña "Publicación", TILDÁ "No publicar en internet" y GUARDÁ.\n` +
      `    (Captura el endpoint de publicación, sin publicar de verdad.) Enter... `
  );

  marker("fin");
  console.log(`\n  ✔ Captura en:\n    ${netPath}\n  ✔ Avisame y la leo.`);
  await rl.question(`Enter para cerrar... `);
  rl.close();
  await context.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
