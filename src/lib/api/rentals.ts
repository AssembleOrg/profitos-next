import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/api/auth";

export { assertAdmin } from "@/lib/api/followups";

export const contractInclude = {
  property: { select: { id: true, address: true, city: true, zone: true, coverImageUrl: true } },
  tenant: { select: { id: true, fullName: true, idType: true, idNumber: true, phone: true, email: true } },
  createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
  additionals: {
    include: {
      additional: { select: { id: true, name: true, defaultAmount: true } },
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  },
  dueDates: {
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
    include: {
      additionals: {
        include: {
          contractAdditional: {
            include: { additional: { select: { id: true, name: true } } },
          },
        },
      },
      transactions: {
        orderBy: [{ paidAt: "desc" }],
        include: {
          createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        },
      },
      actions: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        },
      },
    },
  },
} satisfies Prisma.RentalContractInclude;

export const dueDateInclude = {
  contract: {
    select: {
      id: true,
      title: true,
      gracePeriodDays: true,
      property: { select: { id: true, address: true, city: true } },
      tenant: { select: { id: true, fullName: true, idType: true, idNumber: true, phone: true, email: true } },
    },
  },
  additionals: {
    include: {
      contractAdditional: {
        include: { additional: { select: { id: true, name: true } } },
      },
    },
  },
  transactions: {
    orderBy: [{ paidAt: "desc" }],
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  },
  actions: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.RentalDueDateInclude;

export async function getContractOrThrow(id: string) {
  const contract = await prisma.rentalContract.findUnique({
    where: { id },
    include: contractInclude,
  });
  if (!contract) throw new AppError(404, "Contrato no encontrado");
  return contract;
}

export async function getDueDateOrThrow(id: string) {
  const due = await prisma.rentalDueDate.findUnique({
    where: { id },
    include: dueDateInclude,
  });
  if (!due) throw new AppError(404, "Vencimiento no encontrado");
  return due;
}

/**
 * Recalcula `expectedAmount` de un vencimiento: base + adicionales incluidos.
 * Toma en cuenta `amountOverride` si está; sino usa el `amount` del contractAdditional.
 */
export async function recomputeDueExpectedAmount(dueDateId: string): Promise<number> {
  const due = await prisma.rentalDueDate.findUnique({
    where: { id: dueDateId },
    include: {
      contract: { select: { baseAmount: true } },
      additionals: {
        include: {
          contractAdditional: { select: { amount: true } },
        },
      },
    },
  });
  if (!due) throw new AppError(404, "Vencimiento no encontrado");
  let total = due.contract.baseAmount;
  for (const link of due.additionals) {
    if (!link.included) continue;
    const amount = link.amountOverride ?? link.contractAdditional.amount;
    total += amount;
  }
  await prisma.rentalDueDate.update({
    where: { id: dueDateId },
    data: { expectedAmount: total },
  });
  return total;
}

export function assertCanDeleteContract(
  contract: { createdByUserId: string },
  auth: AuthContext,
) {
  if (auth.isAdmin) return;
  if (contract.createdByUserId === auth.userId) return;
  throw new AppError(403, "Solo el admin o quien creó el contrato puede eliminarlo");
}

export function assertCanDeleteTransaction(
  tx: { createdByUserId: string },
  auth: AuthContext,
) {
  if (auth.isAdmin) return;
  if (tx.createdByUserId === auth.userId) return;
  throw new AppError(403, "Solo el admin o quien registró el pago puede eliminarlo");
}
