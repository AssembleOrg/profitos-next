import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/handler";
import { generateDueDates, isRentalFrequency } from "@/lib/rentals";

/**
 * Crea las cuotas de un contrato administrado (con sus adicionales y la acción
 * de auditoría). La usan el alta (POST /api/alquileres) y la edición cuando un
 * contrato pasa de "lo administra el propietario" a "lo administra la
 * inmobiliaria". Corre dentro de la transacción de quien llama.
 */
export async function createContractDueDates(
  tx: Prisma.TransactionClient,
  contractId: string,
  userId: string,
  reason: string,
): Promise<number> {
  const c = await tx.rentalContract.findUnique({
    where: { id: contractId },
    select: {
      startDate: true,
      endDate: true,
      firstDueDate: true,
      frequency: true,
      baseAmount: true,
      additionals: { select: { id: true, amount: true } },
    },
  });
  if (!c) throw new AppError(404, "Contrato no encontrado");
  if (!isRentalFrequency(c.frequency)) throw new AppError(400, "Frecuencia inválida");

  const generated = generateDueDates({
    startDate: c.startDate,
    endDate: c.endDate,
    firstDueDate: c.firstDueDate,
    frequency: c.frequency,
    baseAmount: c.baseAmount,
  });
  if (generated.length === 0) throw new AppError(400, "No se generaron vencimientos. Revisá las fechas y frecuencia.");

  const totalExpected = c.baseAmount + c.additionals.reduce((acc, x) => acc + x.amount, 0);

  // En lote: una query por tabla en vez de 2-3 por cuota (con muchas cuotas la
  // transacción expiraba).
  const dueRows = await tx.rentalDueDate.createManyAndReturn({
    data: generated.map((due) => ({
      contractId,
      position: due.position,
      dueDate: new Date(due.dueDate),
      expectedAmount: totalExpected,
    })),
    select: { id: true, position: true },
  });

  if (c.additionals.length > 0) {
    await tx.rentalDueDateAdditional.createMany({
      data: dueRows.flatMap((row) =>
        c.additionals.map((ca) => ({ dueDateId: row.id, contractAdditionalId: ca.id, included: true })),
      ),
    });
  }

  await tx.rentalDueDateAction.createMany({
    data: dueRows.map((row) => ({
      dueDateId: row.id,
      type: "creation",
      description: `Cuota ${row.position} generada ${reason}`,
      createdByUserId: userId,
    })),
  });

  return dueRows.length;
}
