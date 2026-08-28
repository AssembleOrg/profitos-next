/**
 * DIAGNÓSTICO del proxy residencial para ZonaProp. Ignora el flag `valid`
 * (usa la sesión fresca de la DB) y NO marca nada inválido. Reporta el status
 * real de la navegación del panel por el proxy y si hay Cloudflare, y si pasa,
 * intenta crear un borrador (in-page fetch). Descartable.
 *
 *   pnpm exec tsx scripts/scraper/zonaprop-proxy-test.ts
 */
import "dotenv/config";
import { chromium, type BrowserContext } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma/client";

const PANEL = "https://www.zonaprop.com.ar/panel/publicador-profesionales/main";
const STEP_OP = "https://www.zonaprop.com.ar/reppro-api/publication/api/v1/posting/STEP_OPERATION";

function proxy() {
  const url = process.env.ZONAPROP_PROXY?.trim();
  if (url) {
    try {
      const u = new URL(url);
      return { server: `${u.protocol}//${u.host}`, username: u.username || undefined, password: u.password || undefined };
    } catch { /* noop */ }
  }
  const server = process.env.PROXY_SERVER?.trim();
  if (server) return { server, username: process.env.PROXY_USER?.trim() || undefined, password: process.env.PROXY_PASS?.trim() || undefined };
  return undefined;
}

async function main() {
  const p = proxy();
  console.log(`Proxy: ${p ? p.server + (p.username ? " (con auth)" : "") : "NINGUNO"}`);
  if (!p) { console.error("✖ No hay proxy en el env (PROXY_SERVER/USER/PASS o ZONAPROP_PROXY)."); process.exit(1); }

  const row = await prisma.scraperSession.findUnique({ where: { portal: "zonaprop" } });
  if (!row) { console.error("✖ No hay sesión de zonaprop en la DB."); process.exit(1); }
  const state = row.storageState as unknown as {
    cookies?: Parameters<BrowserContext["addCookies"]>[0];
    origins?: { origin: string; localStorage?: { name: string; value: string }[] }[];
  };
  const cookies = state.cookies ?? [];
  const sessionId = (cookies as { name: string; value: string }[]).find((c) => c.name === "sessionId")?.value ?? "";
  const lsEntries: [string, string][] = state.origins?.find((o) => o.origin.includes("zonaprop"))?.localStorage?.map((e) => [e.name, e.value]) ?? [];
  console.log(`Sesión (ignorando valid=${row.valid}): ${cookies.length} cookies, ${lsEntries.length} localStorage, sessionId=${sessionId ? "sí" : "NO"}`);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zpt-"));
  const headless = process.env.SCRAPER_HEADLESS === "true"; // default headed acá
  const ctx = await chromium.launchPersistentContext(dir, {
    headless,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    ignoreDefaultArgs: ["--enable-automation"],
    locale: "es-AR",
    proxy: p,
  }).catch(() => chromium.launchPersistentContext(dir, { headless, proxy: p }));

  try {
    await ctx.addInitScript((entries: [string, string][]) => {
      try { if (location.hostname.endsWith("zonaprop.com.ar")) for (const [k, v] of entries) localStorage.setItem(k, v); } catch {}
    }, lsEntries);
    await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
    if (cookies.length) await ctx.addCookies(cookies);

    const page = ctx.pages()[0] ?? (await ctx.newPage());
    console.log("\n→ Navegando el panel por el proxy...");
    const resp = await page.goto(PANEL, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e) => { console.log("  goto error:", e.message); return null; });
    let title = await page.title().catch(() => "");

    // Si es un challenge JS, darle a Chrome hasta 35s para que lo resuelva solo.
    if (/just a moment|un momento/i.test(title)) {
      console.log(`  Challenge de Cloudflare detectado (status ${resp?.status()}). Esperando que resuelva (hasta 35s)...`);
      await page
        .waitForFunction(() => !/just a moment|un momento/i.test(document.title), { timeout: 35_000 })
        .catch(() => {});
      await page.waitForTimeout(2000);
      title = await page.title().catch(() => "");
      console.log(`  Tras esperar: url=${page.url()}  title="${title}"`);
    }
    const bodyText = (await page.evaluate(() => document.body?.innerText?.slice(0, 200)).catch(() => "")) ?? "";
    console.log(`← status=${resp?.status() ?? "?"} url=${page.url()}`);
    console.log(`← title="${title}"`);
    if (/just a moment|challenge|cf-|verifica|verify you are human/i.test(title + " " + bodyText)) {
      console.log("⚠ CLOUDFLARE: el proxy NO pasó el anti-bot. (IP del proxy marcada o no residencial.)");
    } else if (/login|ingresar|iniciar sesión/i.test(page.url() + " " + bodyText)) {
      console.log("⚠ Redirigió a LOGIN: la sesión no autenticó (o localStorage no alcanzó).");
    } else {
      console.log("✓ Panel cargó. Probando crear borrador (in-page fetch)...");
      const res = await page.evaluate(async ({ url, sessionId }) => {
        const r = await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-panel-portal": "ZPAR", sessionid: sessionId, accept: "application/json" }, body: JSON.stringify({ price_operation_type: [{ operation_type: "1" }], real_estate_type_id: "1", real_estate_sub_type_id: "42", postingId: null }) });
        return { status: r.status, text: await r.text() };
      }, { url: STEP_OP, sessionId });
      console.log(`  ← STEP_OPERATION status=${res.status}: ${res.text.slice(0, 200)}`);
      const id = (res.text.match(/"postingId"\s*:\s*"?(\d+)"?/) ?? [])[1];
      if (id) {
        console.log(`\n🎉 BORRADOR creado por el PROXY. postingId=${id} → publicar en ZonaProp queda DESBLOQUEADO para Railway.`);
        console.log(`   Borralo: https://www.zonaprop.com.ar/panel/publicador-profesionales/edition?postingId=${id}`);
        await prisma.scraperSession.update({ where: { portal: "zonaprop" }, data: { valid: true } }).catch(() => {});
      }
    }
  } finally {
    await ctx.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
    await prisma.$disconnect().catch(() => {});
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
