import "dotenv/config";
import { prisma } from "@/lib/prisma/client";

async function main() {
  for (const portal of ["zonaprop", "argenprop", "argenprop-gestion"]) {
    const row = await prisma.scraperSession.findUnique({ where: { portal } });
    if (!row) {
      console.log(`${portal}: NO EXISTE`);
      continue;
    }
    const state = row.storageState as unknown as {
      cookies?: unknown[];
      origins?: { localStorage?: unknown[] }[];
    };
    const ls = (state?.origins ?? []).reduce((a, o) => a + (o.localStorage?.length ?? 0), 0);
    console.log(`${portal}:`, {
      valid: row.valid,
      lastOkAt: row.lastOkAt?.toISOString() ?? null,
      cookies: state?.cookies?.length ?? 0,
      origins: state?.origins?.length ?? 0,
      localStorageItems: ls,
    });
  }
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
