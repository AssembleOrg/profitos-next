/**
 * Relevamiento (SOLO LECTURA) de las estadísticas por aviso del panel de
 * ZonaProp (vistas, impresiones, contactos), para el informe al propietario.
 *
 *   SCRAPER_HEADLESS=false SCRAPER_CHROME_PATH=/usr/bin/brave-browser \
 *     node --import tsx scripts/scraper/discover-estadisticas.ts OUT_DIR [postingId,...]
 *
 * Sin IDs toma los 2 primeros avisos ONLINE del listado. Guarda cada respuesta
 * JSON en OUT_DIR. Endpoints relevados del bundle del panel (nov 2026).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { withZonapropPanel } from "@/lib/zonaprop/browser-publish";

type Get = { status: number; text: string };

async function main() {
  const [out, idsArg] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  await withZonapropPanel(async (page, sessionId) => {
    const get = (url: string) =>
      page.evaluate(
        async ({ url, sessionId }): Promise<Get> => {
          const r = await fetch(url, {
            credentials: "include",
            headers: { accept: "application/json", sessionid: sessionId, "x-panel-portal": "ZPAR" },
          });
          return { status: r.status, text: await r.text() };
        },
        { url, sessionId },
      );
    const save = async (name: string, url: string) => {
      const res = await get(url);
      let body: unknown = res.text.slice(0, 20000);
      try {
        body = JSON.parse(res.text);
      } catch {
        /* no JSON */
      }
      fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ url, status: res.status, body }, null, 2));
      console.log(res.status, res.text.length, url);
      return body;
    };

    let ids = (idsArg ?? "").split(",").filter(Boolean);
    if (!ids.length) {
      const list = (await save("postings_p1", "/avisos-api/panel/api/v2/postings?page=1&limit=10")) as {
        postings?: { postingId: number; stateAndDates?: { status?: string }[] }[];
      };
      ids = (list.postings ?? [])
        .filter((p) => (p.stateAndDates?.[0]?.status ?? "").toUpperCase() === "ONLINE")
        .slice(0, 2)
        .map((p) => String(p.postingId));
    }
    console.log("avisos:", ids.join(", "));

    for (const id of ids) {
      const base = "/avisos-api/panel/api";
      await save(`${id}_statistic_30`, `${base}/v1/statistic/posting/${id}?days=30`);
      await save(`${id}_statistic_365`, `${base}/v1/statistic/posting/${id}?days=365`);
      await save(`${id}_statistic_daily_30`, `${base}/v1/statistic/posting/daily/${id}?days=30`);
      await save(`${id}_viewsstats`, `${base}/v2/postings/getpostingviewsstats?postingId=${id}`);
      await save(`${id}_leadsstats`, `${base}/v2/postings/getpostingleadsstats/${id}?postingId=${id}`);
      await save(`${id}_perf_visits`, `${base}/v1/performance/getpostingvisits?postingId=${id}`);
      await save(`${id}_perf_impressions`, `${base}/v1/performance/getpostingimpressions?postingId=${id}`);
      await save(`${id}_perf_leads`, `${base}/v1/performance/getpostingleads?postingId=${id}`);
      await save(`${id}_perf_statistics`, `${base}/v1/performance/getpostingstatistics?postingId=${id}`);
      await page.waitForTimeout(800);
    }
    await save("publisher_30", "/avisos-api/panel/api/v1/statistic/publisher?days=30");
  });
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
