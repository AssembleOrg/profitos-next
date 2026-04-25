import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { generateAndStoreReceipt } from "@/lib/rentals/receipt";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Registra un pago para un vencimiento.
 * Body:
 *  - amountPaid: total cobrado al inquilino
 *  - commissionAmount: lo que queda para la inmobiliaria (de ese amountPaid)
 *  - method?, paidAt?, isFull (true=total, false=parcial), notes?, attachments?
 *
 * Al confirmar genera un PDF "no fiscal" automáticamente con número correlativo
 * desde la sequence `jp_rental_receipt_seq`, lo guarda en bucket `recibos`
 * y deja el path en `receiptPath`.
 *
 * Si `isFull=true`, marca la cuota como `pagado`.
 * Si `isFull=false`, marca la cuota como `parcial` (a menos que ya esté en otro estado manual).
 */
export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const due = await prisma.rentalDueDate.findUnique({
    where: { id },
    include: {
      contract: {
        include: {
          property: { select: { id: true, address: true, city: true, zone: true } },
          tenant: true,
        },
      },
    },
  });
  if (!due) throw new AppError(404, "Vencimiento no encontrado");

  const body = await request.json();
  const {
    amountPaid,
    commissionAmount,
    method,
    paidAt,
    isFull,
    notes,
    attachments,
  } = body as {
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
  const commission =
    typeof commissionAmount === "number" && Number.isFinite(commissionAmount) && commissionAmount >= 0
      ? commissionAmount
      : 0;
  if (commission > amountPaid) {
    throw new AppError(400, "La comisión no puede ser mayor que el total cobrado");
  }
  const ownerAmount = amountPaid - commission;
  const isFullBool = isFull === true;

  // Reservar el siguiente número de comprobante atomicamente
  const seqResult = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('jp_rental_receipt_seq')::bigint AS nextval
  `;
  const receiptNumber = Number(seqResult[0]?.nextval ?? 0);
  if (!receiptNumber) throw new AppError(500, "No se pudo asignar número de comprobante");

  // Crear la transacción
  const transaction = await prisma.rentalPaymentTransaction.create({
    data: {
      dueDateId: id,
      amountPaid,
      commissionAmount: commission,
      ownerAmount,
      method: method?.trim() || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      isFull: isFullBool,
      notes: notes?.trim() || null,
      attachments: (attachments as Prisma.InputJsonValue) ?? undefined,
      receiptNumber,
      createdByUserId: auth.userId,
    },
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  });

  // Cambio de status según total/parcial
  const nextStatus = isFullBool ? "pagado" : due.status === "pagado" ? due.status : "parcial";
  if (due.status !== nextStatus) {
    await prisma.rentalDueDate.update({
      where: { id },
      data: { status: nextStatus },
    });
    await prisma.rentalDueDateAction.create({
      data: {
        dueDateId: id,
        type: "status_change",
        fromStatus: due.status,
        toStatus: nextStatus,
        description: `Pago registrado: ${isFullBool ? "total" : "parcial"}`,
        createdByUserId: auth.userId,
      },
    });
  }

  // Audit del pago
  await prisma.rentalDueDateAction.create({
    data: {
      dueDateId: id,
      type: "payment",
      description: notes?.trim() || `Pago registrado · comprobante #${receiptNumber}`,
      createdByUserId: auth.userId,
    },
  });

  // Generar PDF del comprobante
  try {
    const { receiptPath } = await generateAndStoreReceipt({
      receiptNumber,
      paidAt: transaction.paidAt,
      amountPaid: transaction.amountPaid,
      commissionAmount: transaction.commissionAmount,
      ownerAmount: transaction.ownerAmount,
      isFull: transaction.isFull,
      method: transaction.method,
      notes: transaction.notes,
      contract: {
        id: due.contract.id,
        title: due.contract.title,
      },
      dueDate: {
        position: due.position,
        dueDate: due.dueDate,
        expectedAmount: due.expectedAmount,
      },
      property: {
        address: due.contract.property.address,
        city: due.contract.property.city,
        zone: due.contract.property.zone,
      },
      tenant: due.contract.tenant,
    });
    await prisma.rentalPaymentTransaction.update({
      where: { id: transaction.id },
      data: { receiptPath, receiptIssuedAt: new Date() },
    });
  } catch (err) {
    console.error("[Recibo PDF] No se pudo generar:", err);
    // No fallamos el endpoint; el pago queda registrado, el recibo puede regenerarse luego.
  }

  const final = await prisma.rentalPaymentTransaction.findUnique({
    where: { id: transaction.id },
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  });

  return created(final, "Pago registrado correctamente", path);
});
