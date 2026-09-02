import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";
import { generateAndStoreReceipt } from "@/lib/rentals/receipt";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Registra un pago sobre un vencimiento de alquiler: transacción con número de
 * comprobante correlativo (sequence `jp_rental_receipt_seq`), cambio de estado
 * de la cuota (pagado/parcial), auditoría y PDF del recibo en el bucket
 * `recibos`. Lo usan la API de la web y la tool del chat IA.
 *
 * Si `isFull=true`, marca la cuota como `pagado`; si no, `parcial` (salvo que
 * ya estuviera pagada).
 */
export interface RegisterPaymentInput {
  dueDateId: string;
  amountPaid: number;
  commissionAmount?: number;
  method?: string | null;
  paidAt?: Date | null;
  isFull: boolean;
  notes?: string | null;
  attachments?: unknown[];
  userId: string;
}

export async function registerRentalPayment(input: RegisterPaymentInput) {
  const due = await prisma.rentalDueDate.findUnique({
    where: { id: input.dueDateId },
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

  const amountPaid = input.amountPaid;
  if (typeof amountPaid !== "number" || !Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new AppError(400, "Monto cobrado inválido");
  }
  const commission =
    typeof input.commissionAmount === "number" && Number.isFinite(input.commissionAmount) && input.commissionAmount >= 0
      ? input.commissionAmount
      : 0;
  if (commission > amountPaid) throw new AppError(400, "La comisión no puede ser mayor que el total cobrado");
  const ownerAmount = amountPaid - commission;
  const isFull = input.isFull === true;

  // Reservar el siguiente número de comprobante atómicamente. La secuencia va
  // calificada con el schema: las queries crudas no usan el search_path de
  // Prisma (que no incluye `profitos`).
  const seqResult = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('profitos.jp_rental_receipt_seq')::bigint AS nextval
  `;
  const receiptNumber = Number(seqResult[0]?.nextval ?? 0);
  if (!receiptNumber) throw new AppError(500, "No se pudo asignar número de comprobante");

  const transaction = await prisma.rentalPaymentTransaction.create({
    data: {
      dueDateId: due.id,
      amountPaid,
      commissionAmount: commission,
      ownerAmount,
      method: input.method?.trim() || null,
      paidAt: input.paidAt ?? new Date(),
      isFull,
      notes: input.notes?.trim() || null,
      attachments: (input.attachments as Prisma.InputJsonValue) ?? undefined,
      receiptNumber,
      createdByUserId: input.userId,
    },
  });

  const nextStatus = isFull ? "pagado" : due.status === "pagado" ? due.status : "parcial";
  if (due.status !== nextStatus) {
    await prisma.rentalDueDate.update({ where: { id: due.id }, data: { status: nextStatus } });
    await prisma.rentalDueDateAction.create({
      data: {
        dueDateId: due.id,
        type: "status_change",
        fromStatus: due.status,
        toStatus: nextStatus,
        description: `Pago registrado: ${isFull ? "total" : "parcial"}`,
        createdByUserId: input.userId,
      },
    });
  }

  await prisma.rentalDueDateAction.create({
    data: {
      dueDateId: due.id,
      type: "payment",
      description: input.notes?.trim() || `Pago registrado · comprobante #${receiptNumber}`,
      createdByUserId: input.userId,
    },
  });

  let receiptPath: string | null = null;
  try {
    const r = await generateAndStoreReceipt({
      receiptNumber,
      paidAt: transaction.paidAt,
      amountPaid: transaction.amountPaid,
      commissionAmount: transaction.commissionAmount,
      ownerAmount: transaction.ownerAmount,
      isFull: transaction.isFull,
      method: transaction.method,
      notes: transaction.notes,
      contract: { id: due.contract.id, title: due.contract.title },
      dueDate: { position: due.position, dueDate: due.dueDate, expectedAmount: due.expectedAmount },
      property: { address: due.contract.property.address, city: due.contract.property.city, zone: due.contract.property.zone },
      tenant: due.contract.tenant,
    });
    receiptPath = r.receiptPath;
    await prisma.rentalPaymentTransaction.update({
      where: { id: transaction.id },
      data: { receiptPath, receiptIssuedAt: new Date() },
    });
  } catch (err) {
    console.error("[Recibo PDF] No se pudo generar:", err);
    // El pago queda registrado; el recibo puede regenerarse luego.
  }

  return { transactionId: transaction.id, receiptNumber, receiptPath, due, nextStatus };
}
