import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assertCronAuthorized } from "@/lib/server/cron-auth";
import { runScraperLeads } from "@/lib/scraper/run";

// Playwright necesita Node runtime (no Edge) y tarda: subimos el límite.
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const g = globalThis as { _scraperRunning?: boolean };

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const secret = process.env.SCRAPER_CRON_SECRET ?? process.env.CRON_SECRET;
  assertCronAuthorized(request.headers, secret, request.nextUrl.searchParams.get("secret"));

  if (g._scraperRunning) {
    return ok({ skipped: true, reason: "in_progress" }, "Scraper ya en ejecución", path);
  }

  g._scraperRunning = true;
  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const result = await runScraperLeads(force);
    if (!result.ran) {
      return ok({ skipped: true, ...result.decision }, "Fuera de ventana de ejecución", path);
    }
    return ok(result, "Scraper de leads ejecutado", path);
  } finally {
    g._scraperRunning = false;
  }
});
