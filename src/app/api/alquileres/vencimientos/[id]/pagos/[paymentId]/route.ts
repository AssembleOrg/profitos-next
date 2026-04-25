import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertCanDeleteTransaction } from "@/lib/api/rentals";

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id, paymentId } = await context!.params;

  const tx = await prisma.rentalPaymentTransaction.findUnique({
    where: { id: paymentId },
    select: { id: true, dueDateId: true, createdByUserId: true, isFull: true, receiptNumber: true },
  });
  if (!tx || tx.dueDateId !== id) throw new AppError(404, "Pago no encontrado");
  assertCanDeleteTransaction(tx, auth);

  await prisma.rentalPaymentTransaction.delete({ where: { id: paymentId } });

  // Si era el único pago "full", revertir el status. Si era parcial, ver si quedan otros.
  const remaining = await prisma.rentalPaymentTransaction.findMany({
    where: { dueDateId: id },
    select: { isFull: true },
  });
  let newStatus: string | null = null;
  if (remaining.length === 0) newStatus = null;
  else if (remaining.some((t) => t.isFull)) newStatus = "pagado";
  else newStatus = "parcial";

  await prisma.rentalDueDate.update({
    where: { id },
    data: { status: newStatus },
  });

  await prisma.rentalDueDateAction.create({
    data: {
      dueDateId: id,
      type: "status_change",
      description: `Pago eliminado (comprobante #${tx.receiptNumber ?? "?"})`,
      createdByUserId: auth.userId,
    },
  });

  return ok(null, "Pago eliminado correctamente", path);
});
