import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { registerRentalPayment } from "@/lib/rentals/register-payment";

/**
 * Registra un pago para un vencimiento.
 * Body:
 *  - amountPaid: total cobrado al inquilino
 *  - commissionAmount: lo que queda para la inmobiliaria (de ese amountPaid)
 *  - method?, paidAt?, isFull (true=total, false=parcial), notes?, attachments?
 *
 * La lógica (número correlativo, cambio de estado, auditoría y PDF del recibo)
 * vive en lib/rentals/register-payment.ts, compartida con la tool del chat.
 */
export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const body = await request.json();
  const { amountPaid, commissionAmount, method, paidAt, isFull, notes, attachments } = body as {
    amountPaid?: number;
    commissionAmount?: number;
    method?: string;
    paidAt?: string;
    isFull?: boolean;
    notes?: string;
    attachments?: unknown[];
  };

  if (typeof amountPaid !== "number" || !Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new AppError(400, "Monto cobrado inválido");
  }

  const { transactionId } = await registerRentalPayment({
    dueDateId: id,
    amountPaid,
    commissionAmount,
    method,
    paidAt: paidAt ? new Date(paidAt) : null,
    isFull: isFull === true,
    notes,
    attachments,
    userId: auth.userId,
  });

  const final = await prisma.rentalPaymentTransaction.findUnique({
    where: { id: transactionId },
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  });

  return created(final, "Pago registrado correctamente", path);
});
