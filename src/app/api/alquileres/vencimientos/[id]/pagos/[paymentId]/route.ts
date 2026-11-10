import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertCanDeleteTransaction } from "@/lib/api/rentals";
import { formatReceiptNo, sanitizeChargeLines } from "@/lib/rentals/money";
import { correctCollection } from "@/lib/rentals/collect";

/**
 * Corrige un cobro ya emitido: cambia sus conceptos y honorarios sin anular los
 * recibos (conservan el número y se vuelven a dibujar). Queda registrado.
 */
export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id, paymentId } = await context!.params;
  const body = (await request.json()) as Record<string, unknown>;

  const result = await correctCollection({
    dueDateId: id,
    transactionId: paymentId,
    lines: sanitizeChargeLines(body.lines),
    feePercent: typeof body.feePercent === "number" ? body.feePercent : Number.NaN,
    receiptNotes: typeof body.receiptNotes === "string" ? body.receiptNotes : null,
    reason: typeof body.reason === "string" ? body.reason : null,
    userId: auth.userId,
  });
  return ok(result, result.pdfErrors.length ? "Cobro corregido. Algún PDF no se pudo regenerar." : "Cobro corregido", path);
});

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

  // Los recibos numerados del cobro quedan en el talonario como anulados (los
  // números no se reutilizan).
  const receipts = await prisma.rentalReceipt.findMany({
    where: { transactionId: paymentId },
    select: { bookKind: true, pointOfSale: true, number: true },
  });
  await prisma.rentalReceipt.updateMany({
    where: { transactionId: paymentId, status: "emitido" },
    data: { status: "anulado", voidReason: "Cobro eliminado", voidedAt: new Date(), voidedByUserId: auth.userId },
  });

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
      description: receipts.length
        ? `Cobro eliminado · recibos anulados: ${receipts.map((r) => formatReceiptNo(r.pointOfSale, r.number)).join(", ")}`
        : `Pago eliminado (comprobante #${tx.receiptNumber ?? "?"})`,
      createdByUserId: auth.userId,
    },
  });

  return ok(null, "Pago eliminado correctamente", path);
});
