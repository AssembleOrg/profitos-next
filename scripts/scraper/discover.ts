/**
 * Script de DESCUBRIMIENTO de selectores (uso único, no va a producción).
 *
 * Abre un Chrome visible, te dejás logueado a mano, y por cada sección que
 * visites vuelca el HTML + un screenshot a una carpeta para que podamos
 * mapear selectores y URLs reales.
 *
 * Uso (en TU terminal, no en background):
 *   pnpm exec tsx scripts/scraper/discover.ts zonaprop
 *   pnpm exec tsx scripts/scraper/discover.ts argenprop
 *
 * No usa las credenciales del .env: el login lo hacés vos manualmente en la
 * ventana. Guarda la sesión (storageState) para reusarla después.
 */
import "dotenv/config";
import { chromium, type BrowserContext, type Page } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

// Carpeta de salida FUERA del repo (contiene sesión y datos personales).
const OUT_DIR =
  "C:/Users/Aaron/AppData/Local/Temp/claude/c--Users-Aaron-Documents-Proyectos-Pistech-care-backend/2a3b2049-c0d7-4b8f-8c98-742405a17ee0/scratchpad/scraper-discovery";

type Portal = "zonaprop" | "argenprop";

const PORTALS: Record<Portal, { home: string; sections: string[] }> = {
  zonaprop: {
    home: "https://www.zonaprop.com.ar/",
    sections: ["interesados", "mensajes", "telefono", "whatsapp"],
  },
  argenprop: {
    home: "https://www.argenprop.com/",
    sections: ["contactados"],
  },
};

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9-]/gi, "_").slice(0, 60);
}

/**
 * Lanza un contexto lo más parecido posible a un navegador humano para
 * evitar el anti-bot (DataDome) de ZonaProp. Usa Chrome real si está
 * instalado; si no, cae al Chromium de Playwright con las mismas defensas.
 */
async function launchStealthContext(userDataDir: string): Promise<BrowserContext> {
  const common = {
    headless: false,
    viewport: null,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    args: [
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  };

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      ...common,
      channel: "chrome", // Chrome real de Google (menos detectable)
    });
    console.log("  → Usando Chrome real (channel: chrome)");
  } catch {
    console.log("  → Chrome no encontrado, uso Chromium de Playwright");
    context = await chromium.launchPersistentContext(userDataDir, common);
  }

  // Oculta la señal más obvia de automation.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return context;
}

async function dump(page: Page, portal: Portal, label: string) {
  const base = path.join(OUT_DIR, `${portal}-${sanitize(label)}`);
  const html = await page.content();
  fs.writeFileSync(`${base}.html`, html, "utf-8");
  await page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => {});
  console.log(`\n  ✔ Volcado: ${base}.html  |  URL actual: ${page.url()}\n`);
}

/**
 * Registra todas las respuestas XHR/fetch JSON (la API interna del portal)
 * a un .jsonl para poder mapear endpoints y forma de los datos.
 */
function attachNetworkCapture(context: BrowserContext, portal: Portal): string {
  const netPath = path.join(OUT_DIR, `${portal}-network.jsonl`);
  fs.writeFileSync(netPath, "");
  let n = 0;
  context.on("response", async (res) => {
    try {
      const req = res.request();
      const rt = req.resourceType();
      if (rt !== "xhr" && rt !== "fetch") return;
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return;
      let body = "";
      try {
        body = await res.text();
      } catch {
        return;
      }
      if (body.length > 800_000) body = body.slice(0, 800_000) + "...[TRUNC]";
      n += 1;
      fs.appendFileSync(
        netPath,
        JSON.stringify({ n, status: res.status(), method: req.method(), url: res.url(), body }) + "\n"
      );
    } catch {
      /* ignore */
    }
  });
  return netPath;
}

async function main() {
  const portal = (process.argv[2] as Portal) ?? "zonaprop";
  const cfg = PORTALS[portal];
  if (!cfg) {
    console.error(`Portal inválido. Usá: zonaprop | argenprop`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rl = readline.createInterface({ input, output });

  const userDataDir = path.join(OUT_DIR, `${portal}-userdata`);
  const context = await launchStealthContext(userDataDir);
  const netPath = attachNetworkCapture(context, portal);
  console.log(`  → Capturando API JSON en: ${netPath}`);
  const page = context.pages()[0] ?? (await context.newPage());

  console.log(`\n=== Descubrimiento: ${portal.toUpperCase()} ===`);
  console.log(`Abriendo ${cfg.home} ...`);
  await page.goto(cfg.home, { waitUntil: "domcontentloaded" }).catch(() => {});

  await rl.question(
    `\n[1] Logueate a mano en la ventana. Cuando estés DENTRO de tu cuenta, apretá Enter aquí... `
  );

  // Guardar la sesión para reusarla en el scraper real.
  const statePath = path.join(OUT_DIR, `${portal}-storageState.json`);
  await context.storageState({ path: statePath });
  console.log(`  ✔ Sesión guardada: ${statePath}`);

  // Recorrer cada sección: vista de lista + detalle de un item.
  for (const section of cfg.sections) {
    await rl.question(
      `\n[${section}] Navegá a la sección "${section}" (vista de LISTA) y apretá Enter... `
    );
    await dump(page, portal, `${section}-lista`);

    const openDetail = await rl.question(
      `        ¿Podés abrir UN aviso/mensaje de "${section}" para ver el detalle? Abrilo y apretá Enter (o escribí "skip"): `
    );
    if (openDetail.trim().toLowerCase() !== "skip") {
      await dump(page, portal, `${section}-detalle`);
    }
  }

  console.log(`\nListo. Archivos en:\n  ${OUT_DIR}\n`);
  await rl.question(`Apretá Enter para cerrar el browser... `);
  rl.close();
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
