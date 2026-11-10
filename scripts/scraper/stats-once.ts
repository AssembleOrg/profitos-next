/**
 * Trae YA las estadísticas de ZonaProp (informe al propietario), sin esperar al worker.
 *
 *   node --import tsx scripts/scraper/stats-once.ts            # una tanda de vencidos (ZP_STATS_BATCH)
 *   node --import tsx scripts/scraper/stats-once.ts 5          # tanda de 5
 *   node --import tsx scripts/scraper/stats-once.ts prop:<id>  # los avisos de una propiedad
 *   node --import tsx scripts/scraper/stats-once.ts ext:<id>,<id>  # avisos puntuales de ZonaProp
 *
 * Local: SCRAPER_HEADLESS=false SCRAPER_CHROME_PATH=/usr/bin/brave-browser (headless no pasa Cloudflare).
 */
import "dotenv/config";
import { refreshPostings, refreshPropertyPostingStats, syncZonapropPostingStats } from "@/lib/zonaprop/posting-stats";

async function main() {
  const arg = process.argv[2] ?? "";
  const r = arg.startsWith("prop:")
    ? await refreshPropertyPostingStats(arg.slice(5))
    : arg.startsWith("ext:")
      ? await refreshPostings(arg.slice(4).split(",").filter(Boolean))
      : await syncZonapropPostingStats(arg ? Number(arg) : undefined);
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
