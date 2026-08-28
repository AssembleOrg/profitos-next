/**
 * Marca una sesión guardada como válida (valid=true) sin re-loguear.
 * Útil cuando el cookie sigue sirviendo pero un run la marcó inválida.
 *
 *   pnpm exec tsx scripts/scraper/session-activate.ts zonaprop
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma/client";

async function main() {
  const portal = process.argv[2] ?? "zonaprop";
  const before = await prisma.scraperSession.findUnique({ where: { portal } });
  console.log(`Antes: portal=${portal} valid=${before?.valid} lastOkAt=${before?.lastOkAt?.toISOString() ?? "—"}`);
  if (!before) {
    console.error("No existe la sesión. Corré el login primero.");
    process.exit(1);
  }
  await prisma.scraperSession.update({ where: { portal }, data: { valid: true } });
  console.log(`✔ ${portal} reactivada (valid=true).`);
  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
