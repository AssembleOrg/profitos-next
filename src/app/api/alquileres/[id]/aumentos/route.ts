import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { applyAdjustment } from "@/lib/rentals/collect";

/** Aplica un aumento: el monto nuevo rige para las cuotas sin cobrar desde la fecha indicada. */
export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json()) as Record<string, unknown>;
  if (typeof body.effectiveDate !== "string") throw new AppError(400, "Falta la fecha desde la que rige");
  const result = await applyAdjustment({
    contractId: id,
    effectiveDate: body.effectiveDate,
    newAmount: typeof body.newAmount === "number" ? body.newAmount : Number.NaN,
    indexLabel: typeof body.indexLabel === "string" ? body.indexLabel : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    userId: auth.userId,
  });
  return created(result, `Aumento aplicado a ${result.affected} cuota${result.affected === 1 ? "" : "s"}`, path);
});
