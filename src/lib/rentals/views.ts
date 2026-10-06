import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { now } from "@/lib/datetime";
import { getDueEffectiveStatus, type RentalDueEffectiveStatus } from "@/lib/rentals";
import type { ChargeLine } from "@/lib/rentals/money";
import { periodLabel, type PaymentBreakdown } from "@/lib/rentals/collect";
import type {
  AdjustmentAlert,
  AgendaAdjustment,
  AgendaDue,
  AgendaEnding,
  AgendaMonth,
  CollectContext,
  ContractDossier,
  ContractRow,
  ContractStatus,
  MonthSummary,
  PartyRef,
  PaymentDTO,
  PropertyRef,
  ReceiptBookDTO,
  ReceiptListItem,
  ReceiptRef,
  ServiceProofDTO,
} from "@/lib/rentals/dto";

/**
 * Consultas de lectura de alquileres v2. Devuelven DTOs planos (ver dto.ts)
 * listos para pasar a componentes cliente.
 */

// ──────────────────────────────────────────────────────────────────
// Fechas
// ──────────────────────────────────────────────────────────────────

/** Fecha pura (medianoche UTC) → "YYYY-MM-DD". */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return now().toISODate() ?? isoDate(new Date());
}

/** "YYYY-MM" válido o el mes actual. */
export function normalizeMonth(value: string | undefined | null): string {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return now().toFormat("yyyy-MM");
}

function monthRange(month: string) {
  const start = DateTime.fromISO(`${month}-01`, { zone: "utc" });
  return { start: start.toJSDate(), end: start.plus({ months: 1 }).toJSDate() };
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    DateTime.fromISO(toISO, { zone: "utc" }).diff(DateTime.fromISO(fromISO, { zone: "utc" }), "days").days,
  );
}

export function adjustmentAlertFor(nextDate: Date | null, today: string): AdjustmentAlert {
  if (!nextDate) return "none";
  const days = daysBetween(today, isoDate(nextDate));
  if (days < 0) return "overdue";
  if (days <= 7) return "due";
  if (days <= 35) return "upcoming";
  return "none";
}

function contractStatus(start: Date, end: Date, today: string): ContractStatus {
  const s = isoDate(start);
  const e = isoDate(end);
  if (today < s) return "futuro";
  if (today > e) return "finalizado";
  return daysBetween(today, e) <= 60 ? "por_vencer" : "vigente";
}

// ──────────────────────────────────────────────────────────────────
// Mapeos comunes
// ──────────────────────────────────────────────────────────────────

const propertySelect = {
  id: true,
  address: true,
  city: true,
  zone: true,
  type: true,
  coverImageUrl: true,
} satisfies Prisma.PropertySelect;

const partySelect = {
  id: true,
  fullName: true,
  idType: true,
  idNumber: true,
  phone: true,
  email: true,
} as const;

function toParty(p: { id: string; fullName: string; idType: string | null; idNumber: string | null; phone: string | null; email: string | null }): PartyRef {
  return { id: p.id, fullName: p.fullName, idType: p.idType, idNumber: p.idNumber, phone: p.phone, email: p.email };
}

function toProperty(p: PropertyRef): PropertyRef {
  return { id: p.id, address: p.address, city: p.city, zone: p.zone, type: p.type, coverImageUrl: p.coverImageUrl };
}

function sumPaid(txs: Array<{ amountPaid: number }>) {
  return txs.reduce((acc, t) => acc + t.amountPaid, 0);
}

function effective(due: { dueDate: Date; status: string | null; expectedAmount: number }, grace: number, collected: number) {
  return getDueEffectiveStatus({
    dueDate: isoDate(due.dueDate),
    status: due.status,
    gracePeriodDays: grace,
    expectedAmount: due.expectedAmount,
    collected,
  });
}

function emptyCounts(): Record<RentalDueEffectiveStatus, number> {
  return { esperando: 0, vencido: 0, pagado: 0, parcial: 0, condonado: 0 };
}

function toReceiptRef(r: {
  id: string;
  bookKind: string;
  pointOfSale: number;
  number: number;
  status: string;
  amount: number | null;
  pdfPath: string | null;
  issuedAt: Date | null;
  voidReason: string | null;
}): ReceiptRef {
  return {
    id: r.id,
    bookKind: r.bookKind === "propietario" ? "propietario" : "inquilino",
    pointOfSale: r.pointOfSale,
    number: r.number,
    status: r.status === "anulado" ? "anulado" : "emitido",
    amount: r.amount,
    hasPdf: Boolean(r.pdfPath),
    issuedAt: r.issuedAt?.toISOString() ?? null,
    voidReason: r.voidReason,
  };
}

function toProof(p: {
  id: string;
  contractId: string;
  service: string;
  period: string;
  amount: number | null;
  attachments: unknown;
  notes: string | null;
  status: string;
  reviewNote: string | null;
  uploadedByTenant: boolean;
  createdAt: Date;
  reviewedAt: Date | null;
}): ServiceProofDTO {
  return {
    id: p.id,
    contractId: p.contractId,
    service: p.service,
    period: p.period,
    amount: p.amount,
    attachments: p.attachments,
    notes: p.notes,
    status: p.status === "aprobado" || p.status === "rechazado" ? p.status : "pendiente",
    reviewNote: p.reviewNote,
    uploadedByTenant: p.uploadedByTenant,
    createdAt: p.createdAt.toISOString(),
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Agenda del mes
// ──────────────────────────────────────────────────────────────────

export async function getAgendaMonth(month: string, q?: string): Promise<AgendaMonth> {
  const today = todayISO();
  const { start, end } = monthRange(month);
  const search: Prisma.RentalContractWhereInput | undefined = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { unit: { contains: q, mode: "insensitive" } },
          { property: { address: { contains: q, mode: "insensitive" } } },
          { tenant: { fullName: { contains: q, mode: "insensitive" } } },
          { owner: { fullName: { contains: q, mode: "insensitive" } } },
        ],
      }
    : undefined;

  const contractSelect = {
    id: true,
    kind: true,
    unit: true,
    currency: true,
    feePercent: true,
    gracePeriodDays: true,
    tenantServices: true,
    baseAmount: true,
    adjustmentIndex: true,
    adjustmentEveryMonths: true,
    adjustmentNextDate: true,
    endDate: true,
    property: { select: propertySelect },
    tenant: { select: partySelect },
    owner: { select: { fullName: true } },
  } satisfies Prisma.RentalContractSelect;

  const [dues, adjustContracts, endingContracts, pendingProofs, globalAdjust, overdueElsewhere] = await Promise.all([
    prisma.rentalDueDate.findMany({
      where: { dueDate: { gte: start, lt: end }, ...(search && { contract: search }) },
      orderBy: [{ dueDate: "asc" }, { position: "asc" }],
      select: {
        id: true,
        contractId: true,
        position: true,
        dueDate: true,
        status: true,
        expectedAmount: true,
        transactions: { select: { amountPaid: true, commissionAmount: true, ownerAmount: true } },
        contract: { select: contractSelect },
      },
    }),
    prisma.rentalContract.findMany({
      where: { adjustmentNextDate: { gte: start, lt: end }, endDate: { gte: start }, ...search },
      select: contractSelect,
    }),
    prisma.rentalContract.findMany({
      where: { endDate: { gte: start, lt: end }, ...search },
      select: contractSelect,
    }),
    prisma.rentalServiceProof.count({ where: { status: "pendiente" } }),
    prisma.rentalContract.findMany({
      where: {
        adjustmentNextDate: { lte: DateTime.fromISO(today, { zone: "utc" }).plus({ days: 7 }).toJSDate() },
        endDate: { gte: DateTime.fromISO(today, { zone: "utc" }).toJSDate() },
      },
      orderBy: { adjustmentNextDate: "asc" },
      select: contractSelect,
    }),
    prisma.rentalDueDate.findMany({
      where: {
        dueDate: { lt: start },
        OR: [{ status: null }, { status: "parcial" }],
      },
      select: { dueDate: true, status: true, expectedAmount: true, transactions: { select: { amountPaid: true } }, contract: { select: { gracePeriodDays: true } } },
    }),
  ]);

  // Comprobantes de servicios del período, por contrato.
  const contractIds = [...new Set(dues.map((d) => d.contractId))];
  const proofs = contractIds.length
    ? await prisma.rentalServiceProof.findMany({
        where: { contractId: { in: contractIds }, period: month },
        select: { contractId: true, service: true, status: true },
      })
    : [];

  const summary: MonthSummary = { expected: 0, collected: 0, overdue: 0, pending: 0, fees: 0, toOwners: 0, counts: emptyCounts() };

  const agendaDues: AgendaDue[] = dues.map((d) => {
    const collected = sumPaid(d.transactions);
    const status = effective(d, d.contract.gracePeriodDays, collected);
    summary.expected += d.expectedAmount;
    summary.collected += collected;
    summary.fees += d.transactions.reduce((a, t) => a + t.commissionAmount, 0);
    summary.toOwners += d.transactions.reduce((a, t) => a + t.ownerAmount, 0);
    summary.counts[status]++;
    const remaining = Math.max(0, d.expectedAmount - collected);
    const late = status === "vencido" || (status === "parcial" && isoDate(d.dueDate) < today);
    if (late) summary.overdue += remaining;
    else if (status === "esperando" || status === "parcial") summary.pending += remaining;
    const mine = proofs.filter((p) => p.contractId === d.contractId);
    return {
      dueId: d.id,
      contractId: d.contractId,
      dueDate: isoDate(d.dueDate),
      position: d.position,
      status,
      expected: d.expectedAmount,
      collected,
      currency: d.contract.currency,
      property: toProperty(d.contract.property),
      unit: d.contract.unit,
      tenant: toParty(d.contract.tenant),
      ownerName: d.contract.owner?.fullName ?? null,
      feePercent: d.contract.feePercent,
      servicesRequired: d.contract.tenantServices,
      servicesUploaded: [...new Set(mine.filter((p) => p.status !== "rechazado").map((p) => p.service))],
      pendingProofs: mine.filter((p) => p.status === "pendiente").length,
      kind: d.contract.kind,
    };
  });

  const toAdj = (c: (typeof adjustContracts)[number]): AgendaAdjustment => ({
    contractId: c.id,
    date: isoDate(c.adjustmentNextDate!),
    alert: adjustmentAlertFor(c.adjustmentNextDate, today),
    index: c.adjustmentIndex,
    everyMonths: c.adjustmentEveryMonths,
    currentAmount: c.baseAmount,
    currency: c.currency,
    property: toProperty(c.property),
    unit: c.unit,
    tenantName: c.tenant.fullName,
  });

  const endings: AgendaEnding[] = endingContracts.map((c) => ({
    contractId: c.id,
    date: isoDate(c.endDate),
    property: toProperty(c.property),
    unit: c.unit,
    tenantName: c.tenant.fullName,
  }));

  const elsewhere = overdueElsewhere.filter((d) => {
    const status = effective(d, d.contract.gracePeriodDays, sumPaid(d.transactions));
    return status === "vencido" || status === "parcial";
  }).length;

  return {
    month,
    today,
    dues: agendaDues,
    adjustments: adjustContracts.filter((c) => c.adjustmentNextDate).map(toAdj),
    endings,
    summary,
    pendingProofs,
    adjustmentsToApply: globalAdjust.filter((c) => c.adjustmentNextDate).map(toAdj),
    overdueElsewhere: elsewhere,
  };
}

// ──────────────────────────────────────────────────────────────────
// Contratos
// ──────────────────────────────────────────────────────────────────

const rowSelect = {
  id: true,
  kind: true,
  title: true,
  unit: true,
  startDate: true,
  endDate: true,
  baseAmount: true,
  currency: true,
  feePercent: true,
  dueDay: true,
  gracePeriodDays: true,
  adjustmentEveryMonths: true,
  adjustmentIndex: true,
  adjustmentNextDate: true,
  property: { select: propertySelect },
  tenant: { select: partySelect },
  owner: { select: partySelect },
  dueDates: {
    orderBy: { dueDate: "asc" },
    select: { id: true, dueDate: true, status: true, expectedAmount: true, transactions: { select: { amountPaid: true } } },
  },
} satisfies Prisma.RentalContractSelect;

type RowSource = Prisma.RentalContractGetPayload<{ select: typeof rowSelect }>;

function toRow(c: RowSource, today: string): ContractRow {
  let nextDue: ContractRow["nextDue"] = null;
  let overdueCount = 0;
  let overdueAmount = 0;
  for (const d of c.dueDates) {
    const collected = sumPaid(d.transactions);
    const status = effective(d, c.gracePeriodDays, collected);
    if (status === "vencido" || (status === "parcial" && isoDate(d.dueDate) < today)) {
      overdueCount++;
      overdueAmount += Math.max(0, d.expectedAmount - collected);
    }
    if (!nextDue && (status === "esperando" || status === "vencido" || status === "parcial")) {
      nextDue = { id: d.id, date: isoDate(d.dueDate), status, amount: Math.max(0, d.expectedAmount - collected) };
    }
  }
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    property: toProperty(c.property),
    unit: c.unit,
    tenant: toParty(c.tenant),
    owner: c.owner ? toParty(c.owner) : null,
    startDate: isoDate(c.startDate),
    endDate: isoDate(c.endDate),
    baseAmount: c.baseAmount,
    currency: c.currency,
    feePercent: c.feePercent,
    dueDay: c.dueDay,
    adjustment: {
      everyMonths: c.adjustmentEveryMonths,
      index: c.adjustmentIndex,
      nextDate: c.adjustmentNextDate ? isoDate(c.adjustmentNextDate) : null,
      alert: adjustmentAlertFor(c.adjustmentNextDate, today),
    },
    status: contractStatus(c.startDate, c.endDate, today),
    nextDue,
    overdueCount,
    overdueAmount,
  };
}

export type ContractFilter = "todos" | "vigentes" | "por_vencer" | "con_deuda" | "aumentan" | "finalizados" | "temporales";

export async function listContracts(opts: { q?: string; filter?: ContractFilter }): Promise<{ rows: ContractRow[]; counts: Record<ContractFilter, number> }> {
  const today = todayISO();
  const where: Prisma.RentalContractWhereInput = {};
  if (opts.q) {
    where.OR = [
      { title: { contains: opts.q, mode: "insensitive" } },
      { unit: { contains: opts.q, mode: "insensitive" } },
      { property: { address: { contains: opts.q, mode: "insensitive" } } },
      { tenant: { fullName: { contains: opts.q, mode: "insensitive" } } },
      { tenant: { idNumber: { contains: opts.q } } },
      { owner: { fullName: { contains: opts.q, mode: "insensitive" } } },
    ];
  }
  const contracts = await prisma.rentalContract.findMany({
    where,
    select: rowSelect,
    orderBy: [{ endDate: "desc" }],
    take: 1000,
  });
  const all = contracts.map((c) => toRow(c, today));
  const test: Record<ContractFilter, (r: ContractRow) => boolean> = {
    todos: () => true,
    vigentes: (r) => r.kind !== "temporal" && (r.status === "vigente" || r.status === "por_vencer" || r.status === "futuro"),
    por_vencer: (r) => r.status === "por_vencer",
    con_deuda: (r) => r.overdueCount > 0,
    aumentan: (r) => r.adjustment.alert !== "none" && r.status !== "finalizado",
    finalizados: (r) => r.status === "finalizado",
    temporales: (r) => r.kind === "temporal",
  };
  const counts = Object.fromEntries(
    (Object.keys(test) as ContractFilter[]).map((k) => [k, all.filter(test[k]).length]),
  ) as Record<ContractFilter, number>;
  const filter = opts.filter ?? "vigentes";
  const rank: Record<ContractStatus, number> = { por_vencer: 0, vigente: 1, futuro: 2, finalizado: 3 };
  const rows = all
    .filter(test[filter])
    .sort((a, b) => b.overdueCount - a.overdueCount || rank[a.status] - rank[b.status] || a.property.address.localeCompare(b.property.address));
  return { rows, counts };
}

// ──────────────────────────────────────────────────────────────────
// Legajo
// ──────────────────────────────────────────────────────────────────

export async function getContractDossier(id: string): Promise<ContractDossier | null> {
  const today = todayISO();
  const c = await prisma.rentalContract.findUnique({
    where: { id },
    select: {
      ...rowSelect,
      frequency: true,
      firstDueDate: true,
      notes: true,
      attachments: true,
      tenantServices: true,
      guaranteeType: true,
      guaranteeDetail: true,
      depositAmount: true,
      advanceAmount: true,
      advanceDetail: true,
      tenant: {
        select: { ...partySelect, portalEnabled: true, authUserId: true, portalInvitedAt: true, portalLastLoginAt: true },
      },
      additionals: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, additionalId: true, amount: true, additional: { select: { name: true } } },
      },
      dueDates: {
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          position: true,
          dueDate: true,
          status: true,
          expectedAmount: true,
          rentAmount: true,
          notes: true,
          additionals: {
            select: {
              id: true,
              included: true,
              amountOverride: true,
              contractAdditional: { select: { id: true, amount: true, additional: { select: { name: true } } } },
            },
          },
          transactions: {
            orderBy: { paidAt: "desc" },
            select: {
              id: true,
              paidAt: true,
              amountPaid: true,
              commissionAmount: true,
              ownerAmount: true,
              feePercent: true,
              isFull: true,
              method: true,
              notes: true,
              breakdown: true,
              attachments: true,
              receiptNumber: true,
              receiptPath: true,
              createdByUser: { select: { fullName: true, email: true } },
              receipts: {
                orderBy: { bookKind: "asc" },
                select: { id: true, bookKind: true, pointOfSale: true, number: true, status: true, amount: true, pdfPath: true, issuedAt: true, voidReason: true },
              },
            },
          },
        },
      },
      adjustments: {
        orderBy: { effectiveDate: "desc" },
        select: {
          id: true,
          effectiveDate: true,
          previousAmount: true,
          newAmount: true,
          indexLabel: true,
          notes: true,
          createdAt: true,
          createdByUser: { select: { fullName: true, email: true } },
        },
      },
      serviceProofs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) return null;

  const row = toRow(c as unknown as RowSource, today);
  let expected = 0;
  let collectedTotal = 0;
  let fees = 0;
  let toOwner = 0;
  const dues = c.dueDates.map((d) => {
    const collected = sumPaid(d.transactions);
    expected += d.expectedAmount;
    collectedTotal += collected;
    const payments: PaymentDTO[] = d.transactions.map((t) => {
      fees += t.commissionAmount;
      toOwner += t.ownerAmount;
      const b = t.breakdown as unknown as PaymentBreakdown | null;
      return {
        id: t.id,
        paidAt: t.paidAt.toISOString(),
        amountPaid: t.amountPaid,
        commissionAmount: t.commissionAmount,
        ownerAmount: t.ownerAmount,
        feePercent: t.feePercent,
        isFull: t.isFull,
        method: t.method,
        notes: t.notes,
        lines: b?.lines ?? null,
        receiptNotes: b?.receiptNotes ?? null,
        receipts: t.receipts.map(toReceiptRef),
        legacyReceipt: t.receiptNumber ? { number: t.receiptNumber, path: t.receiptPath } : null,
        createdBy: t.createdByUser.fullName ?? t.createdByUser.email,
        attachments: t.attachments,
      };
    });
    return {
      id: d.id,
      position: d.position,
      dueDate: isoDate(d.dueDate),
      status: effective(d, c.gracePeriodDays, collected),
      manualStatus: d.status,
      rent: d.rentAmount ?? c.baseAmount,
      expected: d.expectedAmount,
      collected,
      lines: d.additionals.map((l) => ({
        linkId: l.id,
        contractAdditionalId: l.contractAdditional.id,
        name: l.contractAdditional.additional.name,
        amount: l.amountOverride ?? l.contractAdditional.amount,
        included: l.included,
      })),
      notes: d.notes,
      payments,
    };
  });

  return {
    ...row,
    frequency: c.frequency,
    firstDueDate: isoDate(c.firstDueDate),
    gracePeriodDays: c.gracePeriodDays,
    notes: c.notes,
    attachments: c.attachments,
    tenantServices: c.tenantServices,
    guaranteeType: c.guaranteeType,
    guaranteeDetail: c.guaranteeDetail,
    depositAmount: c.depositAmount,
    advanceAmount: c.advanceAmount,
    advanceDetail: c.advanceDetail,
    additionals: c.additionals.map((a) => ({ id: a.id, additionalId: a.additionalId, name: a.additional.name, amount: a.amount })),
    dues,
    adjustments: c.adjustments.map((a) => ({
      id: a.id,
      effectiveDate: isoDate(a.effectiveDate),
      previousAmount: a.previousAmount,
      newAmount: a.newAmount,
      indexLabel: a.indexLabel,
      notes: a.notes,
      createdBy: a.createdByUser.fullName ?? a.createdByUser.email,
      createdAt: a.createdAt.toISOString(),
    })),
    proofs: c.serviceProofs.map(toProof),
    tenantPortal: {
      enabled: c.tenant.portalEnabled,
      hasAccount: Boolean(c.tenant.authUserId),
      invitedAt: c.tenant.portalInvitedAt?.toISOString() ?? null,
      lastLoginAt: c.tenant.portalLastLoginAt?.toISOString() ?? null,
    },
    totals: { expected, collected: collectedTotal, fees, toOwner },
  };
}

// ──────────────────────────────────────────────────────────────────
// Hoja de cobro
// ──────────────────────────────────────────────────────────────────

export async function getReceiptBooks(): Promise<ReceiptBookDTO[]> {
  const books = await prisma.receiptBook.findMany({ orderBy: { kind: "asc" } });
  return books.map((b) => ({
    kind: b.kind === "propietario" ? "propietario" : "inquilino",
    label: b.label,
    pointOfSale: b.pointOfSale,
    nextNumber: b.nextNumber,
    configured: b.configured,
  }));
}

export async function getCollectContext(dueId: string): Promise<CollectContext | null> {
  const today = todayISO();
  const d = await prisma.rentalDueDate.findUnique({
    where: { id: dueId },
    select: {
      id: true,
      dueDate: true,
      status: true,
      expectedAmount: true,
      rentAmount: true,
      transactions: { select: { amountPaid: true } },
      additionals: {
        select: {
          included: true,
          amountOverride: true,
          contractAdditional: { select: { id: true, amount: true, position: true, additional: { select: { name: true } } } },
        },
      },
      contract: {
        select: {
          id: true,
          unit: true,
          currency: true,
          feePercent: true,
          baseAmount: true,
          gracePeriodDays: true,
          tenantServices: true,
          adjustmentNextDate: true,
          property: { select: propertySelect },
          tenant: { select: partySelect },
          owner: { select: partySelect },
        },
      },
    },
  });
  if (!d) return null;
  const period = isoDate(d.dueDate).slice(0, 7);
  const [books, proofs] = await Promise.all([
    getReceiptBooks(),
    prisma.rentalServiceProof.findMany({ where: { contractId: d.contract.id, period }, orderBy: { createdAt: "desc" } }),
  ]);
  const collected = sumPaid(d.transactions);
  const rent = d.rentAmount ?? d.contract.baseAmount;
  const additionalLines = [...d.additionals]
    .sort((a, b) => a.contractAdditional.position - b.contractAdditional.position)
    .map((l) => ({
      kind: "additional" as const,
      label: l.contractAdditional.additional.name,
      amount: l.amountOverride ?? l.contractAdditional.amount,
      refId: l.contractAdditional.id,
      included: l.included,
    }));
  const lines: CollectContext["lines"] = [{ kind: "rent", label: "Alquiler", amount: rent, refId: null, included: true }, ...additionalLines];
  return {
    dueId: d.id,
    contractId: d.contract.id,
    dueDate: isoDate(d.dueDate),
    periodLabel: periodLabel(d.dueDate),
    status: effective(d, d.contract.gracePeriodDays, collected),
    currency: d.contract.currency,
    property: toProperty(d.contract.property),
    unit: d.contract.unit,
    tenant: toParty(d.contract.tenant),
    owner: d.contract.owner ? toParty(d.contract.owner) : null,
    feePercent: d.contract.feePercent,
    rent,
    lines,
    alreadyCollected: collected,
    expected: d.expectedAmount,
    books,
    tenantServices: d.contract.tenantServices,
    proofsThisPeriod: proofs.map(toProof),
    adjustmentAlert: adjustmentAlertFor(d.contract.adjustmentNextDate, today),
    adjustmentDate: d.contract.adjustmentNextDate ? isoDate(d.contract.adjustmentNextDate) : null,
  };
}

// ──────────────────────────────────────────────────────────────────
// Recibos y comprobantes
// ──────────────────────────────────────────────────────────────────

export async function listReceipts(opts: { month?: string; kind?: string; q?: string; status?: string }): Promise<ReceiptListItem[]> {
  const where: Prisma.RentalReceiptWhereInput = {};
  if (opts.kind === "inquilino" || opts.kind === "propietario") where.bookKind = opts.kind;
  if (opts.status === "anulado" || opts.status === "emitido") where.status = opts.status;
  if (opts.month) {
    const { start, end } = monthRange(opts.month);
    where.OR = [{ issuedAt: { gte: start, lt: end } }, { issuedAt: null, createdAt: { gte: start, lt: end } }];
  }
  if (opts.q) {
    const n = Number.parseInt(opts.q.replace(/\D/g, "").slice(-8), 10);
    where.AND = [
      {
        OR: [
          ...(Number.isFinite(n) ? [{ number: n }] : []),
          { contract: { property: { address: { contains: opts.q, mode: "insensitive" } } } },
          { contract: { tenant: { fullName: { contains: opts.q, mode: "insensitive" } } } },
          { contract: { owner: { fullName: { contains: opts.q, mode: "insensitive" } } } },
        ],
      },
    ];
  }
  const rows = await prisma.rentalReceipt.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { number: "desc" }],
    take: 300,
    include: {
      contract: {
        select: {
          unit: true,
          property: { select: { address: true } },
          tenant: { select: { fullName: true } },
          owner: { select: { fullName: true } },
        },
      },
      transaction: { select: { dueDate: { select: { dueDate: true } } } },
      createdByUser: { select: { fullName: true, email: true } },
    },
  });
  return rows.map((r) => ({
    ...toReceiptRef(r),
    contractId: r.contractId,
    propertyAddress: r.contract?.property.address ?? null,
    unit: r.contract?.unit ?? null,
    tenantName: r.contract?.tenant.fullName ?? null,
    ownerName: r.contract?.owner?.fullName ?? null,
    period: r.transaction ? periodLabel(r.transaction.dueDate.dueDate) : null,
    createdBy: r.createdByUser ? (r.createdByUser.fullName ?? r.createdByUser.email) : null,
    voidedAt: r.voidedAt?.toISOString() ?? null,
  }));
}

export async function listServiceProofs(status?: string): Promise<ServiceProofDTO[]> {
  const where: Prisma.RentalServiceProofWhereInput = {};
  if (status === "pendiente" || status === "aprobado" || status === "rechazado") where.status = status;
  const rows = await prisma.rentalServiceProof.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    include: {
      contract: { select: { unit: true, property: { select: propertySelect }, tenant: { select: { fullName: true } } } },
    },
  });
  return rows.map((p) => ({
    ...toProof(p),
    property: toProperty(p.contract.property),
    unit: p.contract.unit,
    tenantName: p.contract.tenant.fullName,
  }));
}

export type { ChargeLine };

// ──────────────────────────────────────────────────────────────────
// Formulario de contrato
// ──────────────────────────────────────────────────────────────────

export async function getContractFormOptions() {
  const [properties, tenants, owners, additionals] = await Promise.all([
    prisma.property.findMany({
      where: { deletedAt: null },
      select: { id: true, address: true, zone: true, city: true, type: true },
      orderBy: { address: "asc" },
      take: 2000,
    }),
    prisma.tenant.findMany({
      select: { id: true, fullName: true, idType: true, idNumber: true, phone: true, email: true },
      orderBy: { fullName: "asc" },
      take: 2000,
    }),
    prisma.owner.findMany({
      select: { id: true, fullName: true, idType: true, idNumber: true },
      orderBy: { fullName: "asc" },
      take: 2000,
    }),
    prisma.rentalAdditional.findMany({ select: { id: true, name: true, defaultAmount: true }, orderBy: { name: "asc" } }),
  ]);
  return { properties, tenants, owners, additionals };
}
