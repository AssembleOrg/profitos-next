/**
 * Relevamiento (SOLO LECTURA) para el panel de Difusión: qué devuelven los
 * listados de ZonaProp y ArgenProp sobre plan, calidad, alertas y errores.
 *
 *   node --import tsx scripts/scraper/discover-difusion.ts [zonaprop|argenprop] OUT_DIR
 *
 * ZonaProp: abre el panel con la sesión guardada, navega el listado de avisos y
 * guarda cada respuesta JSON de las APIs internas que dispara la página.
 * ArgenProp: guarda el HTML de los listados de Gestión.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { withZonapropPanel } from "@/lib/zonaprop/browser-publish";
import { gestionGetHtml } from "@/lib/argenprop/gestion";

const BASE = "https://www.zonaprop.com.ar";

async function zonaprop(out: string) {
  await withZonapropPanel(async (page, sessionId) => {
    let n = 0;
    page.on("response", async (r) => {
      const url = r.url();
      if (!url.includes("zonaprop.com.ar") || !/api/.test(url)) return;
      const ct = r.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return;
      try {
        const body = await r.text();
        const name = `${String(++n).padStart(3, "0")}_${url.replace(/^https?:\/\/[^/]+/, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 120)}.json`;
        fs.writeFileSync(path.join(out, name), JSON.stringify({ url, status: r.status(), body: safeJson(body) }, null, 2));
        console.log(r.status(), url.slice(0, 160));
      } catch {
        /* respuesta sin cuerpo */
      }
    });
    for (const u of (process.env.ZP_PAGES ?? `${BASE}/panel/publicador-profesionales/main`).split(",")) {
      await page.goto(u, { waitUntil: "networkidle", timeout: 60_000 }).catch((e) => console.warn("goto", u, e.message));
      await page.waitForTimeout(8000);
      fs.writeFileSync(path.join(out, `page_${u.split("/").pop()!.replace(/\W+/g, "_")}.html`), await page.content());
      console.log("URL final:", page.url());
    }
    // GET directos (ZP_GET="/avisos-api/...,/avisos-api/...") con el sessionId del panel.
    for (const u of (process.env.ZP_GET ?? "").split(",").filter(Boolean)) {
      const res = await page.evaluate(
        async ({ url, sessionId }) => {
          const r = await fetch(url, { credentials: "include", headers: { accept: "application/json", sessionid: sessionId, "x-panel-portal": "ZPAR" } });
          return { status: r.status, text: await r.text() };
        },
        { url: u, sessionId },
      );
      fs.writeFileSync(path.join(out, `get_${u.replace(/\W+/g, "_").slice(0, 120)}.json`), JSON.stringify({ url: u, status: res.status, body: safeJson(res.text) }, null, 2));
      console.log("GET", res.status, u, res.text.length);
    }
    // Endpoints que menciona el JS del panel (para encontrar calidad/alertas).
    if (process.env.ZP_BUNDLES) {
      const srcs = await page.evaluate(() => [...document.querySelectorAll("script[src]")].map((s) => (s as HTMLScriptElement).src));
      const found = new Set<string>();
      for (const s of srcs) {
        const js = await page.evaluate(async (u) => (await fetch(u)).text(), s).catch(() => "");
        for (const m of js.matchAll(/["'`](\/?(?:avisos-api|reppro-api|panel)\/[^"'`\s]{3,160})["'`]/g)) found.add(m[1]);
        if (process.env.ZP_SAVE_BUNDLES && js) fs.writeFileSync(path.join(out, `bundle_${s.split("/").pop()!.replace(/\W+/g, "_").slice(0, 80)}.js`), js);
        const ctx = [...js.matchAll(/performance\/get|checkReport|postings\/report|auditory|getduplicated/g)]
          .map((m) => js.slice(Math.max(0, m.index! - 600), m.index! + 600))
          .join("\n\n=====\n\n");
        if (ctx) fs.appendFileSync(path.join(out, "bundle-context.txt"), `\n\n##### ${s}\n${ctx}`);
      }
      fs.writeFileSync(path.join(out, "bundle-endpoints.txt"), [...found].sort().join("\n"));
      console.log("endpoints en bundles:", found.size, "de", srcs.length, "scripts");
    }
  });
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t.slice(0, 5000);
  }
}

async function argenprop(out: string) {
  for (const slug of ["vigente", "suspendido", "reservado", "borrador", "pendiente", "rechazado", "vencido", "finalizado"]) {
    try {
      const html = await gestionGetHtml(`/propiedades-${slug}`);
      fs.writeFileSync(path.join(out, `ap_${slug}.html`), html);
      console.log(slug, html.length, html.includes(`estadoaviso=${slug}`));
    } catch (e) {
      console.warn(slug, e instanceof Error ? e.message : e);
    }
  }
  const home = await gestionGetHtml(`/`);
  fs.writeFileSync(path.join(out, `ap_home.html`), home);
}

async function main() {
  const [portal, out] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  if (portal === "zonaprop") await zonaprop(out);
  else await argenprop(out);
  process.exit(0);
}
main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
