// Firma → pendientes en estados de cuenta.
// - A cobrar (ingreso): nuestros honorarios, o el total si "cobramos todo".
// - A pagar (egreso): la parte del colega, solo si "cobramos todo".
// Cada firma tiene a lo sumo un pendiente de cada tipo. Se recalculan con cada
// cambio de la firma; una vez cobrado/pagado algo de ese tipo ya no se toca.

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

/** Categoría de lo que se le paga al colega: "Honorarios a colegas" o la primera de egresos de Ventas. */
async function colleaguePayoutCategoryId(db: Db): Promise<string | null> {
  const seed = await db.accountCategory.findFirst({
    where: { id: "seed_colleague_payout", archivedAt: null },
    select: { id: true },
  });
  if (seed) return seed.id;
  const any = await db.accountCategory.findFirst({
    where: { kind: "expense", area: "ventas", archivedAt: null, isSystem: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return any?.id ?? null;
}

interface PendingTarget {
  amount: number;
  description: string;
  counterparty: string | null;
}

async function syncOne(
  db: Db,
  proposal: { id: string; propertyId: string; createdByUserId: string; dateAgreed: Date | null; reservationDate: Date | null },
  entries: { id: string; status: string; type: string }[],
  type: "income" | "expense",
  target: PendingTarget | null,
  base: Record<string, unknown>
) {
  const ofType = entries.filter((e) => e.type === type);
  // Ya cobrado/pagado (aunque sea en parte): queda como está.
  if (ofType.some((e) => e.status === "collected")) return;
  const pending = ofType.find((e) => e.status === "pending") ?? null;

  if (!target || target.amount <= 0) {
    if (pending) await db.accountEntry.delete({ where: { id: pending.id } });
    return;
  }
  const data = { ...base, type, amount: target.amount, description: target.description, counterparty: target.counterparty };
  if (pending) {
    await db.accountEntry.update({ where: { id: pending.id }, data });
    return;
  }
  await db.accountEntry.create({
    data: {
      ...data,
      currency: base.currency as string,
      status: "pending",
      categoryId: type === "income" ? await saleCategoryId(db) : await colleaguePayoutCategoryId(db),
      // Fecha contable provisoria: se fija al cobrar/pagar.
      date: proposal.dateAgreed ?? proposal.reservationDate ?? new Date(),
      signatureProposalId: proposal.id,
      createdByUserId: proposal.createdByUserId,
    },
  });
}

export async function syncSignatureReceivable(proposalId: string, db: Db = prisma): Promise<void> {
  const proposal = await db.signatureProposal.findUnique({
    where: { id: proposalId },
    include: {
      property: { select: { address: true } },
      colleagueAgency: { select: { name: true } },
      accountEntries: { select: { id: true, status: true, type: true } },
    },
  });
  if (!proposal) return;

  const fees = proposal.status === "propuesta_rechazada" ? null : computeSignatureFees(proposal);
  const currency: Currency = isCurrency(proposal.operationCurrency) ? proposal.operationCurrency : "USD";
  const colleagueWho = proposal.colleagueAgency?.name ?? proposal.colleagueName ?? null;
  const collectsAll = proposal.withColleague && proposal.collectsAll && (fees?.colleague ?? 0) > 0;

  const feeText =
    proposal.feeAmount != null && proposal.feeAmount > 0
      ? `monto fijo ${formatMoney(proposal.feeAmount, currency)}`
      : `${proposal.feePercentage}% de ${formatMoney(proposal.operationAmount ?? 0, currency)}`;
  const shared = proposal.withColleague
    ? ` · compartido ${proposal.colleagueSharePercent}%${colleagueWho ? ` con ${colleagueWho}` : ""}`
    : "";

  const base = {
    currency,
    propertyId: proposal.propertyId,
    feePercentage: proposal.feeAmount != null && proposal.feeAmount > 0 ? null : proposal.feePercentage,
    isShared: proposal.withColleague,
    sharedAgencyId: proposal.withColleague ? proposal.colleagueAgencyId : null,
  };

  const income: PendingTarget | null = fees
    ? {
        amount: collectsAll ? fees.total : fees.ours,
        description: `Honorarios firma · ${feeText}${shared}${collectsAll ? " · cobramos el total" : ""}`,
        counterparty: null,
      }
    : null;
  const expense: PendingTarget | null =
    fees && collectsAll
      ? {
          amount: fees.colleague,
          description: `Parte del colega · ${proposal.colleagueSharePercent}% de ${formatMoney(fees.total, currency)}`,
          counterparty: colleagueWho,
        }
      : null;

  await syncOne(db, proposal, proposal.accountEntries, "income", income, base);
  await syncOne(db, proposal, proposal.accountEntries, "expense", expense, base);
}
