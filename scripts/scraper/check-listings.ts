/**
 * Chequea los avisos de ZonaProp / ArgenProp contra el estado real del portal
 * (ver lib/publish/listing-sync.ts). ZonaProp usa el navegador: correr EN EL
 * WORKER, no local.
 *
 *   DISPLAY=:99 node --import tsx scripts/scraper/check-listings.ts [zonaprop|argenprop] [--dry]
 */
import "dotenv/config";
import { syncArgenpropListings, syncZonapropListings } from "@/lib/publish/listing-sync";

async function main() {
  const dryRun = process.argv.includes("--dry");
  const portals = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const run = portals.length ? portals : ["argenprop", "zonaprop"];
  for (const portal of run) {
    const r = portal === "zonaprop" ? await syncZonapropListings({ dryRun }) : await syncArgenpropListings({ dryRun });
    console.log(`${dryRun ? "[dry] " : ""}${JSON.stringify({ ...r, changes: r.changes.length })}`);
    for (const c of r.changes) console.log("  ", c);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
