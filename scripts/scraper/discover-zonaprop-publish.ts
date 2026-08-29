/**
 * DESCUBRIMIENTO del endpoint de PUBLICAR/ACTIVAR y de SUBIR FOTOS en ZonaProp.
 * Uso único, INTERACTIVO (corré en TU terminal, no en background).
 *
 * Carga la sesión guardada (DB) + proxy + Brave, abre el panel headed y GRABA
 * toda la red (req+res+payload) mientras vos hacés unas acciones guiadas. La
 * idea es capturar SIN publicar nada nuevo: pausás y reactivás un aviso ya
 * existente (eso dispara el endpoint de estado/activación) y agregás una foto.
 *
 *   SCRAPER_CHROME_PATH=/usr/bin/brave-browser \
 *     pnpm exec tsx scripts/scraper/discover-zonaprop-publish.ts
 *
 * Al terminar te dice el archivo .jsonl a pasarme (tiene datos de sesión → se
 * borra después de analizarlo).
 */
import "dotenv/config";
import { chromium as chromiumExtra } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma/client";

chromiumExtra.use(StealthPlugin());

const PANEL = "https://www.zonaprop.com.ar/panel/avisos";
const OUT = path.join(os.tmpdir(), `zp-discover-${Date.now()}`);

function proxy() {
  const server = process.env.PROXY_SERVER?.trim();
  if (!server) return undefined;
  return { server, username: process.env.PROXY_USER?.trim() || undefined, password: process.env.PROXY_PASS?.trim() || undefined };
}

const SENSITIVE = new Set(["cookie", "sessionid", "authorization", "x-csrf-token"]);
function safeHeaders(h: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = SENSITIVE.has(k.toLowerCase()) ? "[REDACTED]" : v;
  return out;
}
function interesting(method: string, url: string): boolean {
  if (method !== "GET") return true;
  return /api|posting|aviso|publica|activ|estado|status|upload|foto|image|photo|multimedia|preview/i.test(url);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const netPath = path.join(OUT, "publish-network.jsonl");
  fs.writeFileSync(netPath, "");
  const write = (o: object) => fs.appendFileSync(netPath, JSON.stringify(o) + "\n");
  const marker = (label: string) => write({ phase: "marker", t: new Date().toISOString(), label });

  const row = await prisma.scraperSession.findUnique({ where: { portal: "zonaprop" } });
  if (!row) throw new Error("Sin sesión de zonaprop en la DB. Corré login.ts primero.");
  const state = row.storageState as unknown as {
    cookies?: Parameters<BrowserContext["addCookies"]>[0];
    origins?: { origin: string; localStorage?: { name: string; value: string }[] }[];
  };
  const cookies = state.cookies ?? [];
  const ls = state.origins?.find((o) => o.origin.includes("zonaprop"))?.localStorage?.map((e) => [e.name, e.value] as [string, string]) ?? [];

  const execPath = process.env.SCRAPER_CHROME_PATH?.trim();
  const opts = {
    headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled", "--no-sandbox"],
    ignoreDefaultArgs: ["--enable-automation"],
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    ...(proxy() ? { proxy: proxy() } : {}),
    ...(execPath ? { executablePath: execPath } : {}),
  };
  const ctx = await chromiumExtra.launchPersistentContext(path.join(OUT, "userdata"), opts);

  await ctx.addInitScript((entries: [string, string][]) => {
    try { if (location.hostname.endsWith("zonaprop.com.ar")) for (const [k, v] of entries) localStorage.setItem(k, v); } catch {}
  }, ls);
  await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
  if (cookies.length) await ctx.addCookies(cookies);

  ctx.on("request", (req) => {
    const m = req.method(), url = req.url();
    if (!interesting(m, url)) return;
    if (m === "GET" && ["image", "font", "stylesheet"].includes(req.resourceType())) return;
    let postData = "";
    try { postData = req.postData() ?? ""; } catch { postData = "[binary/multipart]"; }
    if (postData.length > 30_000) postData = postData.slice(0, 30_000) + "...[TRUNC]";
    write({ phase: "req", t: new Date().toISOString(), method: m, url, resourceType: req.resourceType(), headers: safeHeaders(req.headers()), postData });
  });
  ctx.on("response", async (res) => {
    const req = res.request(), m = req.method(), url = res.url();
    if (!interesting(m, url)) return;
    const ct = res.headers()["content-type"] ?? "";
    let body = "";
    if (ct.includes("json") || ct.includes("text")) { try { body = await res.text(); } catch {} if (body.length > 100_000) body = body.slice(0, 100_000) + "...[TRUNC]"; }
    write({ phase: "res", t: new Date().toISOString(), status: res.status(), method: m, url, contentType: ct, body });
  });

  const rl = readline.createInterface({ input, output });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  console.log(`\nGrabando red en: ${netPath}`);
  console.log("Abriendo el panel de inmuebles...");
  await page.goto(PANEL, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});

  console.log(`\n⚠️  OJO: este flujo captura una PUBLICACIÓN REAL → consume 1 crédito/plan de ZonaProp.`);
  console.log(`   Hacelo con un aviso que quieras publicar DE VERDAD (así el crédito no se desperdicia).`);

  await rl.question(`\n[1] Esperá a que cargue el panel (si pide login, avisá y frenamos). Enter... `);

  marker("A-wizard-fotos");
  await rl.question(
    `\n[A] Entrá a "Publicar aviso" y completá los pasos (operación, tipo, ubicación,\n` +
      `    descripción, características, precio) INCLUYENDO las FOTOS (subí al menos una).\n` +
      `    Frená JUSTO ANTES de elegir plan / confirmar. Enter cuando estés en el paso de plan... `
  );

  marker("B-elegir-plan");
  await rl.question(
    `\n[B] Elegí el PLAN de publicación (ej: Simple). NO confirmes todavía. Enter cuando lo elegiste... `
  );

  marker("C-confirmar-publicar");
  await rl.question(
    `\n[C] Ahora CONFIRMÁ la publicación (Publicar / Finalizar). Esto GASTA el crédito y captura\n` +
      `    el endpoint de ACTIVAR. Enter cuando el aviso quedó publicado/activo... `
  );

  marker("D-mejorar-exposicion");
  await rl.question(
    `\n[D] MEJORAR EXPOSICIÓN (upgrade de plan): en un aviso publicado, tocá "Mejorar exposición",\n` +
      `    elegí un plan superior (ej: Destacado). Para capturar el UPGRADE completo hay que\n` +
      `    CONFIRMAR (gasta otro crédito); si no querés gastar, frená ANTES de pagar (capturamos\n` +
      `    igual la selección). Enter cuando terminaste (o si lo salteás)... `
  );

  marker("fin");
  console.log(`\n✔ Listo. Pasame este archivo:\n  ${netPath}`);
  console.log(`  (tiene datos de sesión → lo borramos después de analizarlo)`);
  await rl.question(`\nEnter para cerrar el browser... `);
  rl.close();
  await ctx.close().catch(() => {});
  await prisma.$disconnect().catch(() => {});
}

main().catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
