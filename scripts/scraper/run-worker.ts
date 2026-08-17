/**
 * Entrypoint del WORKER del scraper (Railway lo corre como cron service).
 *
 * Aplica la política de horarios (1h en oficina / 6h fuera), corre el scraper
 * una vez y TERMINA. No es un servidor: se prende, hace lo suyo, y se apaga.
 *
 * Uso:
 *   pnpm exec tsx scripts/scraper/run-worker.ts            # respeta el horario
 *   pnpm exec tsx scripts/scraper/run-worker.ts --force    # corre igual (pruebas)
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma/client";
import { runScraperLeads } from "@/lib/scraper/run";

console.log("[worker] proceso iniciado", new Date().toISOString());

// Corte de seguridad: si algo se cuelga, matamos el proceso para no gastar
// recursos (ni plata) de más. Configurable por env; default 5 min.
const MAX_RUNTIME_MS = Number(process.env.SCRAPER_MAX_RUNTIME_MS ?? 300_000);
const killer = setTimeout(() => {
  console.error(`[worker] Timeout de ${MAX_RUNTIME_MS}ms alcanzado. Abortando.`);
  process.exit(1);
}, MAX_RUNTIME_MS);

async function main() {
  const force = process.argv.includes("--force");
  const result = await runScraperLeads(force);

  if (!result.ran) {
    const d = result.decision;
    console.log(
      `[worker] Salteado (${d.reason}) — hora AR ${d.hour}h, oficina=${d.office}, ` +
        `intervalo ${d.minIntervalMin}min, última hace ${d.elapsedMin ?? "—"}min.`
    );
    return;
  }

  for (const p of result.portals) {
    if (p.ok) console.log(`[worker] ${p.portal} OK:`, JSON.stringify(p.result));
    else console.warn(`[worker] ${p.portal} FALLÓ: ${p.error}`);
  }
  console.log("[worker] Listo.");
}

main()
  .then(async () => {
    clearTimeout(killer);
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    clearTimeout(killer);
    console.error("[worker] Falla general:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
