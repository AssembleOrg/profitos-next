import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { assertCronAuthorized } from "@/lib/server/cron-auth";
import { syncHolidays } from "@/lib/holidays/server";
import { currentAndNextMonth } from "@/lib/holidays/colegio";
import { now } from "@/lib/datetime";

/**
 * Chequeo de feriados contra la calculadora del Colegio de Escribanos.
 * - Normal (lo llama el worker los lunes): mes actual + el siguiente.
 * - `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`: un rango a mano (carga inicial).
 * Si cambió algo, recalcula los vencimientos abiertos (avisos + Google Calendar).
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  assertCronAuthorized(request.headers, process.env.CRON_SECRET);

  const sp = request.nextUrl.searchParams;
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const custom = valid(sp.get("desde")) && valid(sp.get("hasta")) ? { from: sp.get("desde")!, to: sp.get("hasta")! } : null;
  const range = custom ?? currentAndNextMonth(now().toISODate()!);

  const result = await syncHolidays(range.from, range.to);
  console.log(
    `[feriados] ${range.from}..${range.to}: +${result.added.length} −${result.removed.length}, ${result.recalculated.length} vencimientos recalculados`,
  );
  return ok(result, "Feriados actualizados", path);
});
