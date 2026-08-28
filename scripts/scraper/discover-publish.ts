/**
 * DESCUBRIMIENTO del flujo de PUBLICAR un aviso en ZonaProp (uso único).
 *
 * NO crea avisos: reverseamos desde EDITAR un aviso ya existente. Al editar y
 * guardar un cambio trivial (que después revertís) capturamos el endpoint de
 * escritura + su payload, y al gestionar las fotos capturamos ese flujo. El
 * endpoint de crear suele ser el mismo recurso (POST vs PUT), así que con esto
 * inferimos crear sin publicar nada nuevo.
 *
 * A diferencia de discover.ts, guarda también el PAYLOAD de los requests.
 *
 * Uso (en TU terminal, NO en background):
 *   pnpm exec tsx scripts/scraper/discover-publish.ts
 *
 * Después de capturar, pasame el archivo publish-network.jsonl (o los pocos
 * requests relevantes). Contiene datos de sesión → lo borramos al terminar.
 */
import "dotenv/config";
import { chromium, type BrowserContext } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

// Carpeta FUERA del repo (contiene sesión y datos personales).
const OUT_DIR = "C:/Users/Aaron/AppData/Local/Temp/zonaprop-publish-discovery";
const HOME = "https://www.zonaprop.com.ar/panel/inmuebles";

// Solo nos interesa el tráfico de API: no-GET (crear/subir) o GETs a endpoints
// de datos de referencia (categorías, tipos, ubicación) útiles para el payload.
function interesting(method: string, url: string): boolean {
  if (method !== "GET") return true;
  return /api|posting|aviso|publica|upload|foto|image|photo|location|categor|tipo|precio|price/i.test(
    url
  );
}

// No guardar valores de headers sensibles (el archivo igual es privado, pero
// evitamos dejar el token de sesión en texto plano de más).
const SENSITIVE = new Set(["cookie", "sessionid", "authorization", "x-csrf-token"]);
function safeHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    const key = k.toLowerCase();
    out[key] = SENSITIVE.has(key) ? "[REDACTED]" : v;
  }
  return out;
}

async function launchContext(userDataDir: string): Promise<BrowserContext> {
  const common = {
    headless: false,
    viewport: null,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(userDataDir, { ...common, channel: "chrome" });
    console.log("  → Usando Chrome real (channel: chrome)");
  } catch {
    console.log("  → Chrome no encontrado, uso Chromium de Playwright");
    context = await chromium.launchPersistentContext(userDataDir, common);
  }
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return context;
}

type Capture = { netPath: string; marker: (label: string) => void };

function attachCapture(context: BrowserContext): Capture {
  const netPath = path.join(OUT_DIR, "publish-network.jsonl");
  fs.writeFileSync(netPath, "");
  let n = 0;
  const write = (o: object) => fs.appendFileSync(netPath, JSON.stringify(o) + "\n");
  // Marca de segmento para correlacionar cada paso con sus requests.
  const marker = (label: string) => write({ phase: "marker", t: new Date().toISOString(), label });

  context.on("request", (req) => {
    const method = req.method();
    const url = req.url();
    if (!interesting(method, url)) return;
    const rt = req.resourceType();
    if (method === "GET" && (rt === "image" || rt === "font" || rt === "stylesheet")) return;
    let postData = "";
    try {
      postData = req.postData() ?? "";
    } catch {
      postData = "[binary/multipart]";
    }
    if (postData.length > 30_000) postData = postData.slice(0, 30_000) + "...[TRUNC]";
    n += 1;
    write({
      n,
      phase: "req",
      t: new Date().toISOString(),
      method,
      url,
      resourceType: rt,
      headers: safeHeaders(req.headers()),
      postData,
    });
  });

  context.on("response", async (res) => {
    const req = res.request();
    const method = req.method();
    const url = res.url();
    if (!interesting(method, url)) return;
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
    write({
      n,
      phase: "res",
      t: new Date().toISOString(),
      status: res.status(),
      method,
      url,
      contentType: ct,
      body,
    });
  });

  return { netPath, marker };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rl = readline.createInterface({ input, output });

  const userDataDir = path.join(OUT_DIR, "userdata");
  const context = await launchContext(userDataDir);
  const { netPath, marker } = attachCapture(context);
  console.log(`  → Capturando API (req+res) en: ${netPath}`);

  const page = context.pages()[0] ?? (await context.newPage());
  console.log(`\nAbriendo ${HOME} ...`);
  await page.goto(HOME, { waitUntil: "domcontentloaded" }).catch(() => {});

  await rl.question(
    `\n[1] Logueate a mano si hace falta. Cuando estés DENTRO del panel (lista de tus avisos), apretá Enter... `
  );

  marker("A-abrir-editar");
  await rl.question(
    `\n[A] Abrí UN aviso ya publicado en "Editar" y esperá a que cargue el formulario\n` +
      `    con todos los datos. (Esto captura el ESQUEMA completo del aviso.)\n` +
      `    Cuando cargó, apretá Enter... `
  );

  marker("B-guardar-cambio");
  await rl.question(
    `\n[B] Hacé un cambio trivial y reversible (ej: agregá un espacio a la descripción)\n` +
      `    y apretá GUARDAR. (Esto captura el endpoint de ESCRITURA + su payload.)\n` +
      `    Cuando guardó, apretá Enter... `
  );

  marker("C-fotos");
  await rl.question(
    `\n[C] Entrá a gestionar las FOTOS de ese aviso: agregá una foto (o reordená).\n` +
      `    (Esto captura la SUBIDA de fotos y cómo se adjuntan al aviso.)\n` +
      `    Cuando terminaste, apretá Enter... `
  );

  marker("D-flujo-publicar-sin-confirmar");
  await rl.question(
    `\n[D] OPCIONAL: entrá a "Publicar aviso" (nuevo) y avanzá los pasos\n` +
      `    (operación, tipo, ubicación...) SIN CONFIRMAR la publicación final.\n` +
      `    (Captura los datos de referencia: categorías, tipos, ubicación.)\n` +
      `    NO confirmes. Cuando llegaste lo más lejos posible, apretá Enter... `
  );

  marker("fin");
  console.log(`\n  ✔ Captura guardada en:\n    ${netPath}`);
  console.log(`  ✔ Acordate de REVERTIR el cambio trivial del aviso.`);
  console.log(`  ✔ Pasame ese archivo (o los requests de guardar-aviso y subir-foto).`);

  await rl.question(`\nApretá Enter para cerrar el browser... `);
  rl.close();
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
