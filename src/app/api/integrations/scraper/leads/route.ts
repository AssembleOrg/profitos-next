import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assertCronAuthorized } from "@/lib/server/cron-auth";
import { prisma } from "@/lib/prisma/client";
import { scrapeZonaprop } from "@/lib/scraper/zonaprop";
import { scrapeArgenprop } from "@/lib/scraper/argenprop";
import { SessionExpiredError } from "@/lib/scraper/session";
import { decideRun } from "@/lib/scraper/schedule";

const SYNC_KEY = "scraper:leads";

// Playwright necesita Node runtime (no Edge) y tarda: subimos el límite.
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const g = globalThis as { _scraperRunning?: boolean };

async function runPortal(name: string, fn: () => Promise<unknown>) {
  try {
    return { portal: name, ok: true, result: await fn() };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return { portal: name, ok: false, error: "session_expired" };
    }
    return { portal: name, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const secret = process.env.SCRAPER_CRON_SECRET ?? process.env.CRON_SECRET;
  assertCronAuthorized(request.headers, secret, request.nextUrl.searchParams.get("secret"));

  if (g._scraperRunning) {
    return ok({ skipped: true, reason: "in_progress" }, "Scraper ya en ejecución", path);
  }

  // Política de horarios: cada 1h en oficina (09-19), cada 6h fuera. `?force=1`
  // saltea el throttle (para pruebas / corrida manual).
  const force = request.nextUrl.searchParams.get("force") === "1";
  const state = await prisma.integrationSyncState.findUnique({ where: { integrationKey: SYNC_KEY } });
  const decision = decideRun(state?.lastRunAt ?? null);
  if (!decision.run && !force) {
    return ok({ skipped: true, ...decision }, "Fuera de ventana de ejecución", path);
  }

  g._scraperRunning = true;
  try {
    // Secuencial a propósito: un browser por vez (memoria) y menos huella anti-bot.
    const zonaprop = await runPortal("zonaprop", scrapeZonaprop);
    const argenprop = await runPortal("argenprop", scrapeArgenprop);

    await prisma.integrationSyncState.upsert({
      where: { integrationKey: SYNC_KEY },
      create: { integrationKey: SYNC_KEY, lastRunAt: new Date() },
      update: { lastRunAt: new Date() },
    });

    return ok({ zonaprop, argenprop, schedule: decision }, "Scraper de leads ejecutado", path);
  } finally {
    g._scraperRunning = false;
  }
});
