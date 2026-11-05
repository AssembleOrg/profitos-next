import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

interface Body {
  transactionIds?: string[];
  /** De dónde sale la plata del propietario. Sin dato: del bolsillo donde entró el cobro. */
  fund?: string | null;
  /** true = deshacer (vuelve a "sin retirar"). Solo admin. */
  undo?: boolean;
}

/** El propietario retiró su parte de uno o varios cobros de alquiler. */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const body = (await request.json()) as Body;
  const ids = Array.isArray(body.transactionIds) ? body.transactionIds.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) throw new AppError(400, "Elegí al menos un cobro");
  if (body.fund != null && body.fund !== "caja" && body.fund !== "banco") {
    throw new AppError(400, "El propietario cobra de la caja o del banco");
  }

  if (body.undo === true) {
    if (!auth.isAdmin) throw new AppError(403, "Solo un administrador puede deshacer una rendición");
    const res = await prisma.rentalPaymentTransaction.updateMany({
      where: { id: { in: ids }, fund: { not: null } },
      data: { ownerPaidAt: null, ownerPaidFund: null, ownerPaidByUserId: null },
    });
    return ok({ count: res.count }, "Vuelve a figurar como sin retirar", path);
  }

  const rows = await prisma.rentalPaymentTransaction.findMany({
    where: { id: { in: ids }, ownerPaidAt: null, fund: { not: null } },
    select: { id: true, fund: true },
  });
  if (rows.length === 0) throw new AppError(400, "Esos cobros ya figuran como retirados");
  const paidAt = new Date();
  await prisma.$transaction(
    rows.map((r) =>
      prisma.rentalPaymentTransaction.update({
        where: { id: r.id },
        data: { ownerPaidAt: paidAt, ownerPaidFund: body.fund ?? r.fund, ownerPaidByUserId: auth.userId },
      })
    )
  );
  return ok({ count: rows.length }, rows.length === 1 ? "Marcado como retirado" : `${rows.length} cobros marcados como retirados`, path);
});
