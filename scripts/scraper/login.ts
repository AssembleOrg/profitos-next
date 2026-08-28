/**
 * Re-login manual de un portal → guarda la sesión (storageState) en la DB
 * (tabla jp_scraper_sessions) para que el scraper automático la reuse.
 *
 * Correr en TU terminal (abre un Chrome visible):
 *   pnpm exec tsx scripts/scraper/login.ts zonaprop
 *   pnpm exec tsx scripts/scraper/login.ts argenprop
 *
 * Logueate a mano en la ventana; cuando estés dentro, apretá Enter.
 */
import "dotenv/config";
import { chromium, type BrowserContext } from "playwright";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";

const HOME: Record<string, string> = {
  zonaprop: "https://www.zonaprop.com.ar/panel/interesados",
  argenprop: "https://www.argenprop.com/micuenta/mismensajes",
  // CRM de ArgenProp para publicar (login con reCAPTCHA → cookies para HTTP plano).
  "argenprop-gestion": "https://gestion.argenprop.com/",
};

function prisma(): PrismaClient {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
  let schema: string | undefined;
  try {
    schema = new URL(connectionString).searchParams.get("schema") ?? undefined;
  } catch {
    schema = undefined;
  }
  const adapter = new PrismaPg({ connectionString }, { schema });
  return new PrismaClient({ adapter });
}

async function launch(): Promise<BrowserContext> {
  const opts = {
    headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  let browser;
  const execPath = process.env.SCRAPER_CHROME_PATH?.trim();
  if (execPath) {
    browser = await chromium.launch({ ...opts, executablePath: execPath });
  } else {
    try {
      browser = await chromium.launch({ ...opts, channel: "chrome" });
    } catch {
      browser = await chromium.launch(opts);
    }
  }
  const ctx = await browser.newContext({ viewport: null, locale: "es-AR" });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return ctx;
}

async function saveState(portal: string, state: object) {
  const db = prisma();
  await db.scraperSession.upsert({
    where: { portal },
    create: { portal, storageState: state, valid: true, lastOkAt: new Date() },
    update: { storageState: state, valid: true, lastOkAt: new Date() },
  });
  await db.$disconnect();
  console.log(`\n✔ Sesión de ${portal} guardada en la DB (jp_scraper_sessions).`);
}

async function main() {
  const portal = process.argv[2];
  if (!portal || !HOME[portal]) {
    console.error("Usá: zonaprop | argenprop [--from <storageState.json>]");
    process.exit(1);
  }

  // Modo import: cargar un storageState ya capturado, sin abrir browser.
  const fromIdx = process.argv.indexOf("--from");
  if (fromIdx !== -1 && process.argv[fromIdx + 1]) {
    const state = JSON.parse(fs.readFileSync(process.argv[fromIdx + 1], "utf-8"));
    await saveState(portal, state);
    return;
  }

  const rl = readline.createInterface({ input, output });
  const context = await launch();
  const page = await context.newPage();
  await page.goto(HOME[portal], { waitUntil: "domcontentloaded" }).catch(() => {});

  await rl.question(`\nLogueate a mano en la ventana. Cuando estés DENTRO, apretá Enter... `);

  await saveState(portal, (await context.storageState()) as object);
  rl.close();
  await context.browser()?.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
