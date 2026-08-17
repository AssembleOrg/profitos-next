import { prisma } from "@/lib/prisma/client";
import { scrapeZonaprop } from "./zonaprop";
import { scrapeArgenprop } from "./argenprop";
import { SessionExpiredError } from "./session";
import { decideRun, type ScheduleDecision } from "./schedule";

const SYNC_KEY = "scraper:leads";

export type PortalResult = { portal: string; ok: boolean; result?: unknown; error?: string };

async function runPortal(name: string, fn: () => Promise<unknown>): Promise<PortalResult> {
  try {
    return { portal: name, ok: true, result: await fn() };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return { portal: name, ok: false, error: "session_expired" };
    }
    return { portal: name, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type RunResult =
  | { ran: false; decision: ScheduleDecision }
  | { ran: true; decision: ScheduleDecision; portals: PortalResult[] };

/**
 * Corre el scraper de ambos portales respetando la política de horarios.
 * `force` saltea el throttle. Actualiza la última corrida en la DB.
 * Lo usan tanto el worker (cron) como el endpoint HTTP.
 */
export async function runScraperLeads(force = false): Promise<RunResult> {
  const state = await prisma.integrationSyncState.findUnique({ where: { integrationKey: SYNC_KEY } });
  const decision = decideRun(state?.lastRunAt ?? null);
  if (!decision.run && !force) return { ran: false, decision };

  // Secuencial: un browser por vez (memoria) y menos huella anti-bot.
  const portals = [
    await runPortal("zonaprop", scrapeZonaprop),
    await runPortal("argenprop", scrapeArgenprop),
  ];

  await prisma.integrationSyncState.upsert({
    where: { integrationKey: SYNC_KEY },
    create: { integrationKey: SYNC_KEY, lastRunAt: new Date() },
    update: { lastRunAt: new Date() },
  });

  return { ran: true, decision, portals };
}
