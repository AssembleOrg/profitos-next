/**
 * Corre el scraper una vez desde la terminal (sin el endpoint HTTP).
 *   pnpm exec tsx scripts/scraper/run-once.ts            # ambos
 *   pnpm exec tsx scripts/scraper/run-once.ts zonaprop   # uno solo
 * Tip: SCRAPER_HEADLESS=false para ver el browser.
 */
import "dotenv/config";
import { scrapeZonaprop } from "@/lib/scraper/zonaprop";
import { scrapeArgenprop } from "@/lib/scraper/argenprop";

async function main() {
  const only = process.argv[2];
  if (!only || only === "zonaprop") {
    console.log("ZONAPROP:", JSON.stringify(await scrapeZonaprop(), null, 2));
  }
  if (!only || only === "argenprop") {
    console.log("ARGENPROP:", JSON.stringify(await scrapeArgenprop(), null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
