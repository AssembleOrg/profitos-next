// Firma → honorarios "a cobrar" en estados de cuenta.
// Cada firma con valor y % de honorarios tiene a lo sumo un movimiento
// pendiente (status "pending"). Se recalcula con cada cambio de la firma;
// una vez cobrado (status "collected") ya no se toca.

import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { formatMoney, isCurrency, type Currency } from "@/lib/account";
import { computeSignatureFees } from "@/lib/signatures/fees";

type Db = Prisma.TransactionClient | typeof prisma;

/** Categoría donde caen los honorarios de venta: "Comisión de venta" o la primera de ingresos de Ventas. */
async function saleCategoryId(db: Db): Promise<string | null> {
  const seed = await db.accountCategory.findFirst({
    where: { id: "seed_sale_commission", archivedAt: null },
    select: { id: true },
  });
  if (seed) return seed.id;
  const any = await db.accountCategory.findFirst({
    where: { kind: "income", area: "ventas", archivedAt: null, isSystem: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return any?.id ?? null;
}

export async function syncSignatureReceivable(proposalId: string, db: Db = prisma): Promise<void> {
  const proposal = await db.signatureProposal.findUnique({
    where: { id: proposalId },
    include: {
      property: { select: { address: true } },
      colleagueAgency: { select: { name: true } },
      accountEntries: { select: { id: true, status: true } },
    },
  });
  if (!proposal) return;

  // Ya cobrado: los honorarios quedaron registrados como ingreso real.
  if (proposal.accountEntries.some((e) => e.status === "collected")) return;
  const pending = proposal.accountEntries.find((e) => e.status === "pending") ?? null;

  const fees = computeSignatureFees(proposal);
  const currency: Currency = isCurrency(proposal.operationCurrency) ? proposal.operationCurrency : "USD";

  if (!fees || fees.ours <= 0 || proposal.status === "propuesta_rechazada") {
    if (pending) await db.accountEntry.delete({ where: { id: pending.id } });
    return;
  }

  const shared = proposal.withColleague
    ? ` · compartido ${proposal.colleagueSharePercent}%${
        proposal.colleagueAgency?.name || proposal.colleagueName
          ? ` con ${proposal.colleagueAgency?.name ?? proposal.colleagueName}`
          : ""
      }`
    : "";
  const description = `Honorarios firma · ${proposal.feePercentage}% de ${formatMoney(proposal.operationAmount!, currency)}${shared}`;

  const data = {
    type: "income",
    amount: fees.ours,
    currency,
    description,
    propertyId: proposal.propertyId,
    feePercentage: proposal.feePercentage,
    isShared: proposal.withColleague,
    sharedAgencyId: proposal.withColleague ? proposal.colleagueAgencyId : null,
  };

  if (pending) {
    await db.accountEntry.update({ where: { id: pending.id }, data });
    return;
  }
  await db.accountEntry.create({
    data: {
      ...data,
      status: "pending",
      categoryId: await saleCategoryId(db),
      // Fecha contable provisoria: se fija al cobrar.
      date: proposal.dateAgreed ?? proposal.reservationDate ?? new Date(),
      signatureProposalId: proposal.id,
      createdByUserId: proposal.createdByUserId,
    },
  });
}
