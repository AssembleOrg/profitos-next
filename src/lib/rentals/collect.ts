import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";
import type { Prisma } from "@/generated/prisma/client";
import { formatARS } from "@/lib/rentals";
import { formatReceiptNo, sanitizeFeePercent, splitCharges, type ChargeLine, type ChargeSplit } from "@/lib/rentals/money";
import { renderReceiptPdf, receiptStoragePath, storeReceiptPdf, type ReceiptKind } from "@/lib/rentals/receipt-v2";

/**
 * Operaciones de alquiler tradicional (v2): cobro con dos recibos numerados,
 * talonarios, anulaciones y aumentos. Las usan las APIs del staff.
 */

type Tx = Prisma.TransactionClient;

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Fecha pura (medianoche UTC) → "Octubre 2026". */
export function periodLabel(date: Date): string {
  return `${MONTHS_ES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export interface PaymentBreakdown {
  lines: ChargeLine[];
  split: ChargeSplit;
  receiptNotes: string | null;
}

// ──────────────────────────────────────────────────────────────────
// Talonarios
// ──────────────────────────────────────────────────────────────────

/**
 * Reserva un número del talonario dentro de una transacción (lock de fila).
 * Si `requested` viene, se usa ese número (editable por el usuario) siempre que
 * no esté tomado; si no, el próximo. El próximo número avanza al mayor usado + 1.
 */
async function reserveNumber(tx: Tx, kind: ReceiptKind, requested?: number | null) {
  const rows = await tx.$queryRaw<Array<{ point_of_sale: number; next_number: number }>>`
    SELECT point_of_sale, next_number FROM profitos.jp_receipt_books WHERE kind = ${kind} FOR UPDATE
  `;
  const book = rows[0];
  if (!book) throw new AppError(500, `No existe el talonario "${kind}"`);
  const number = requested && Number.isInteger(requested) && requested > 0 ? requested : book.next_number;
  const taken = await tx.rentalReceipt.findUnique({
    where: { bookKind_pointOfSale_number: { bookKind: kind, pointOfSale: book.point_of_sale, number } },
    select: { status: true },
  });
  if (taken) {
    throw new AppError(
      409,
      `El número ${formatReceiptNo(book.point_of_sale, number)} ya está ${taken.status === "anulado" ? "anulado" : "usado"} en el talonario ${kind === "inquilino" ? "del inquilino" : "del propietario"}`,
    );
  }
  await tx.receiptBook.update({
    where: { kind },
    data: { nextNumber: Math.max(book.next_number, number + 1), configured: true },
  });
  return { pointOfSale: book.point_of_sale, number };
}

export async function updateReceiptBook(kind: ReceiptKind, data: { nextNumber?: number; pointOfSale?: number }) {
  const patch: Prisma.ReceiptBookUpdateInput = { configured: true };
  if (data.nextNumber !== undefined) {
    if (!Number.isInteger(data.nextNumber) || data.nextNumber < 1) throw new AppError(400, "Número inválido");
    patch.nextNumber = data.nextNumber;
  }
  if (data.pointOfSale !== undefined) {
    if (!Number.isInteger(data.pointOfSale) || data.pointOfSale < 1 || data.pointOfSale > 9999) {
      throw new AppError(400, "Punto de venta inválido");
    }
    patch.pointOfSale = data.pointOfSale;
  }
  return prisma.receiptBook.update({ where: { kind }, data: patch });
}

/** Anula un número sin usar (hoja del talonario rota, salteada, etc.). */
export async function voidUnusedNumber(kind: ReceiptKind, number: number, reason: string, userId: string) {
  if (!Number.isInteger(number) || number < 1) throw new AppError(400, "Número inválido");
  return prisma.$transaction(async (tx) => {
    const r = await reserveNumber(tx, kind, number);
    return tx.rentalReceipt.create({
      data: {
        bookKind: kind,
        pointOfSale: r.pointOfSale,
        number: r.number,
        status: "anulado",
        voidReason: reason.trim() || "Anulado",
        voidedAt: new Date(),
        voidedByUserId: userId,
        createdByUserId: userId,
      },
    });
  });
}

export async function voidReceipt(id: string, reason: string, userId: string) {
  const receipt = await prisma.rentalReceipt.findUnique({ where: { id } });
  if (!receipt) throw new AppError(404, "Recibo no encontrado");
  if (receipt.status === "anulado") throw new AppError(409, "El recibo ya está anulado");
  return prisma.rentalReceipt.update({
    where: { id },
    data: { status: "anulado", voidReason: reason.trim() || "Anulado", voidedAt: new Date(), voidedByUserId: userId },
  });
}

// ──────────────────────────────────────────────────────────────────
// Cobro
// ──────────────────────────────────────────────────────────────────

export interface CollectInput {
  dueDateId: string;
  lines: ChargeLine[];
  feePercent: number;
  isFull: boolean;
  paidAt?: Date | null;
  method?: string | null;
  /** Nota interna del cobro (historial). */
  notes?: string | null;
  /** Observaciones que se imprimen en ambos recibos. */
  receiptNotes?: string | null;
  attachments?: unknown[];
  tenantReceiptNumber?: number | null;
  ownerReceiptNumber?: number | null;
  issueOwnerReceipt: boolean;
  userId: string;
}

export async function collectRent(input: CollectInput) {
  if (input.lines.length === 0) throw new AppError(400, "Agregá al menos un concepto");
  if (input.lines.some((l) => l.amount < 0)) throw new AppError(400, "Los montos no pueden ser negativos");
  const split = splitCharges(input.lines, sanitizeFeePercent(input.feePercent));
  if (split.tenantTotal <= 0) throw new AppError(400, "El total cobrado tiene que ser mayor a cero");

  const breakdown: PaymentBreakdown = { lines: input.lines, split, receiptNotes: input.receiptNotes?.trim() || null };

  const result = await prisma.$transaction(async (tx) => {
    const due = await tx.rentalDueDate.findUnique({
      where: { id: input.dueDateId },
      select: { id: true, status: true, contractId: true },
    });
    if (!due) throw new AppError(404, "Vencimiento no encontrado");

    const transaction = await tx.rentalPaymentTransaction.create({
      data: {
        dueDateId: due.id,
        amountPaid: split.tenantTotal,
        commissionAmount: split.feeAmount,
        ownerAmount: split.ownerTotal,
        feePercent: split.feePercent,
        breakdown: breakdown as unknown as Prisma.InputJsonValue,
        method: input.method?.trim() || null,
        paidAt: input.paidAt ?? new Date(),
        isFull: input.isFull,
        notes: input.notes?.trim() || null,
        attachments: (input.attachments as Prisma.InputJsonValue) ?? undefined,
        createdByUserId: input.userId,
      },
    });

    const receiptIds: string[] = [];
    const tenantNo = await reserveNumber(tx, "inquilino", input.tenantReceiptNumber);
    const tenantReceipt = await tx.rentalReceipt.create({
      data: {
        bookKind: "inquilino",
        ...tenantNo,
        transactionId: transaction.id,
        contractId: due.contractId,
        amount: split.tenantTotal,
        createdByUserId: input.userId,
      },
    });
    receiptIds.push(tenantReceipt.id);
    if (input.issueOwnerReceipt) {
      const ownerNo = await reserveNumber(tx, "propietario", input.ownerReceiptNumber);
      const ownerReceipt = await tx.rentalReceipt.create({
        data: {
          bookKind: "propietario",
          ...ownerNo,
          transactionId: transaction.id,
          contractId: due.contractId,
          amount: split.ownerTotal,
          createdByUserId: input.userId,
        },
      });
      receiptIds.push(ownerReceipt.id);
    }

    const nextStatus = input.isFull ? "pagado" : due.status === "pagado" ? due.status : "parcial";
    if (due.status !== nextStatus) {
      await tx.rentalDueDate.update({ where: { id: due.id }, data: { status: nextStatus } });
      await tx.rentalDueDateAction.create({
        data: {
          dueDateId: due.id,
          type: "status_change",
          fromStatus: due.status,
          toStatus: nextStatus,
          description: `Cobro ${input.isFull ? "total" : "parcial"}`,
          createdByUserId: input.userId,
        },
      });
    }
    await tx.rentalDueDateAction.create({
      data: {
        dueDateId: due.id,
        type: "payment",
        description:
          input.notes?.trim() ||
          `Cobro registrado · recibo ${formatReceiptNo(tenantNo.pointOfSale, tenantNo.number)}`,
        createdByUserId: input.userId,
      },
    });

    return { transactionId: transaction.id, receiptIds, nextStatus };
  });

  // Los PDFs se generan fuera de la transacción: si fallan, el cobro y los
  // números quedan registrados y el PDF se puede regenerar.
  const pdfErrors: string[] = [];
  for (const id of result.receiptIds) {
    try {
      await ensureReceiptPdf(id, { force: true });
    } catch (err) {
      console.error("[Recibo v2] No se pudo generar el PDF:", err);
      pdfErrors.push(id);
    }
  }
  return { ...result, pdfErrors };
}

/** Genera (o regenera) el PDF de un recibo emitido a partir del desglose congelado del cobro. */
export async function ensureReceiptPdf(receiptId: string, opts: { force?: boolean } = {}) {
  const receipt = await prisma.rentalReceipt.findUnique({
    where: { id: receiptId },
    include: {
      transaction: {
        include: {
          dueDate: {
            include: {
              contract: {
                include: {
                  property: { select: { address: true, city: true, zone: true, type: true } },
                  tenant: { select: { fullName: true, idType: true, idNumber: true } },
                  owner: { select: { fullName: true, idType: true, idNumber: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) throw new AppError(404, "Recibo no encontrado");
  if (receipt.pdfPath && !opts.force) return receipt.pdfPath;
  const tx = receipt.transaction;
  if (!tx) throw new AppError(409, "El recibo no tiene un cobro asociado");

  const contract = tx.dueDate.contract;
  const stored = tx.breakdown as unknown as PaymentBreakdown | null;
  const lines: ChargeLine[] = stored?.lines ?? [{ kind: "rent", label: "Alquiler", amount: tx.amountPaid }];
  const kind = receipt.bookKind as ReceiptKind;
  const pdfInput = {
    kind,
    pointOfSale: receipt.pointOfSale,
    number: receipt.number,
    issuedAt: tx.paidAt,
    currency: contract.currency,
    amount: kind === "inquilino" ? tx.amountPaid : tx.ownerAmount,
    lines,
    feeAmount: tx.commissionAmount,
    feePercent: tx.feePercent ?? stored?.split.feePercent ?? 0,
    periodLabel: periodLabel(tx.dueDate.dueDate),
    owner: contract.owner,
    tenant: contract.tenant,
    property: { ...contract.property, unit: contract.unit },
    notes: stored?.receiptNotes ?? null,
    isPartial: !tx.isFull,
  };
  const bytes = await renderReceiptPdf(pdfInput);
  const path = receiptStoragePath(pdfInput);
  await storeReceiptPdf(path, bytes);
  await prisma.rentalReceipt.update({
    where: { id: receipt.id },
    data: { pdfPath: path, issuedAt: receipt.issuedAt ?? new Date() },
  });
  return path;
}

// ──────────────────────────────────────────────────────────────────
// Aumentos
// ──────────────────────────────────────────────────────────────────

function dateOnly(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new AppError(400, "Fecha inválida");
  return d;
}

/** Próxima fecha de aumento a partir de una fecha base (fecha pura UTC). */
export function addMonthsDateOnly(date: Date, months: number): Date {
  const dt = DateTime.fromJSDate(date, { zone: "utc" }).plus({ months });
  return dt.toJSDate();
}

export interface ApplyAdjustmentInput {
  contractId: string;
  /** YYYY-MM-DD: primera cuota con el monto nuevo es la que vence desde esta fecha. */
  effectiveDate: string;
  newAmount: number;
  indexLabel?: string | null;
  notes?: string | null;
  userId: string;
}

export async function applyAdjustment(input: ApplyAdjustmentInput) {
  if (!Number.isFinite(input.newAmount) || input.newAmount <= 0) throw new AppError(400, "Monto nuevo inválido");
  const effective = dateOnly(input.effectiveDate);

  return prisma.$transaction(async (tx) => {
    const contract = await tx.rentalContract.findUnique({
      where: { id: input.contractId },
      include: {
        dueDates: {
          orderBy: { dueDate: "asc" },
          include: {
            transactions: { select: { id: true } },
            additionals: { include: { contractAdditional: { select: { amount: true } } } },
          },
        },
      },
    });
    if (!contract) throw new AppError(404, "Contrato no encontrado");

    const firstAffected = contract.dueDates.find((d) => d.dueDate >= effective);
    const previousAmount = firstAffected?.rentAmount ?? contract.baseAmount;

    let affected = 0;
    for (const due of contract.dueDates) {
      if (due.dueDate < effective) {
        // Congelar el alquiler de las cuotas anteriores al aumento.
        if (due.rentAmount === null) {
          await tx.rentalDueDate.update({ where: { id: due.id }, data: { rentAmount: contract.baseAmount } });
        }
        continue;
      }
      // Las cuotas ya cobradas (total o parcial) no se tocan: la diferencia se
      // cobra aparte como concepto "Diferencia de aumento".
      if (due.transactions.length > 0 || due.status === "pagado" || due.status === "condonado") continue;
      const extras = due.additionals.reduce(
        (acc, l) => acc + (l.included ? (l.amountOverride ?? l.contractAdditional.amount) : 0),
        0,
      );
      await tx.rentalDueDate.update({
        where: { id: due.id },
        data: { rentAmount: input.newAmount, expectedAmount: input.newAmount + extras },
      });
      affected++;
    }

    const nextDate = contract.adjustmentEveryMonths
      ? addMonthsDateOnly(effective, contract.adjustmentEveryMonths)
      : null;

    await tx.rentalContract.update({
      where: { id: contract.id },
      data: { baseAmount: input.newAmount, adjustmentNextDate: nextDate },
    });

    const adjustment = await tx.rentalAdjustment.create({
      data: {
        contractId: contract.id,
        effectiveDate: effective,
        previousAmount,
        newAmount: input.newAmount,
        indexLabel: input.indexLabel?.trim() || contract.adjustmentIndex || null,
        notes: input.notes?.trim() || null,
        createdByUserId: input.userId,
      },
    });

    if (firstAffected) {
      await tx.rentalDueDateAction.create({
        data: {
          dueDateId: firstAffected.id,
          type: "nota",
          description: `Aumento aplicado: alquiler de ${formatARS(previousAmount)} a ${formatARS(input.newAmount)}${adjustment.indexLabel ? ` (${adjustment.indexLabel})` : ""}`,
          createdByUserId: input.userId,
        },
      });
    }

    return { adjustment, affected, nextDate };
  });
}
