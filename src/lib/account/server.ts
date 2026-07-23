// ────────────────────────────────────────────────────────────────────
// Acceso a datos para Estados de cuenta. Combina movimientos manuales
// (jp_account_entries) con comisiones de alquiler "virtuales" calculadas
// al vuelo desde jp_rental_payment_transactions.
// ────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma/client";
import { fromISO, fromJSDate } from "@/lib/datetime";
import type { Prisma } from "@/generated/prisma/client";
import { fetchCostearExpenses, type CostearExpense } from "@/lib/costear/client";
import {
  buildReport,
  CURRENCIES,
  isCurrency,
  RENTAL_COMMISSION_CATEGORY_ID,
  type AccountMovement,
  type AccountReport,
  type Currency,
  type EntryType,
  type MovementSource,
  type OpeningByCurrency,
} from "./index";

export interface MovementFilters {
  from?: string; // ISO date YYYY-MM-DD (inclusive)
  to?: string; // ISO date YYYY-MM-DD (inclusive)
  type?: EntryType;
  categoryId?: string;
  currency?: Currency;
  agentUserId?: string;
  isShared?: boolean;
  source?: MovementSource;
}

export interface ReportOptions {
  /**
   * Incluir los gastos personales de Costear (solo la dueña, ver isCostearOwner).
   * Se listan con badge pero no entran en el saldo de la inmobiliaria.
   */
  includeCostear?: boolean;
}

function userName(user: { fullName: string | null; email: string } | null): string | null {
  if (!user) return null;
  return user.fullName?.trim() || user.email;
}

function manualWhere(filters: MovementFilters, beforeRange = false): Prisma.AccountEntryWhereInput {
  const where: Prisma.AccountEntryWhereInput = {};
  const dateFilter: Prisma.DateTimeFilter = {};
  if (beforeRange) {
    if (filters.from) dateFilter.lt = new Date(`${filters.from}T00:00:00.000Z`);
  } else {
    if (filters.from) dateFilter.gte = new Date(`${filters.from}T00:00:00.000Z`);
    if (filters.to) dateFilter.lte = new Date(`${filters.to}T00:00:00.000Z`);
  }
  if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
  if (filters.type) where.type = filters.type;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.currency) where.currency = filters.currency;
  if (filters.agentUserId) where.agentUserId = filters.agentUserId;
  if (filters.isShared !== undefined) where.isShared = filters.isShared;
  return where;
}

function shouldIncludeRental(filters: MovementFilters): boolean {
  if (filters.source === "manual") return false;
  if (filters.type && filters.type !== "income") return false;
  if (filters.categoryId && filters.categoryId !== RENTAL_COMMISSION_CATEGORY_ID) return false;
  // Las comisiones de alquiler nunca son "compartidas".
  if (filters.isShared === true) return false;
  return true;
}

function rentalWhere(filters: MovementFilters, beforeRange = false): Prisma.RentalPaymentTransactionWhereInput {
  const where: Prisma.RentalPaymentTransactionWhereInput = {
    commissionAmount: { gt: 0 },
  };
  const paidAt: Prisma.DateTimeFilter = {};
  if (beforeRange) {
    if (filters.from) paidAt.lt = fromISO(filters.from).startOf("day").toJSDate();
  } else {
    if (filters.from) paidAt.gte = fromISO(filters.from).startOf("day").toJSDate();
    if (filters.to) paidAt.lte = fromISO(filters.to).endOf("day").toJSDate();
  }
  if (Object.keys(paidAt).length > 0) where.paidAt = paidAt;
  // El "agente" de una comisión de alquiler es quien registró el pago.
  if (filters.agentUserId) where.createdByUserId = filters.agentUserId;
  if (filters.currency) where.dueDate = { contract: { is: { currency: filters.currency } } };
  return where;
}

const manualInclude = {
  category: { select: { id: true, name: true, color: true } },
  agentUser: { select: { id: true, fullName: true, email: true } },
  property: { select: { id: true, address: true } },
  createdByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AccountEntryInclude;

const rentalInclude = {
  createdByUser: { select: { id: true, fullName: true, email: true } },
  dueDate: {
    select: {
      contract: {
        select: {
          currency: true,
          property: { select: { id: true, address: true } },
        },
      },
    },
  },
} satisfies Prisma.RentalPaymentTransactionInclude;

function mapManual(entry: Prisma.AccountEntryGetPayload<{ include: typeof manualInclude }>): AccountMovement {
  return {
    id: entry.id,
    source: "manual",
    type: entry.type as EntryType,
    categoryId: entry.categoryId,
    categoryName: entry.category?.name ?? null,
    categoryColor: entry.category?.color ?? null,
    amount: entry.amount,
    currency: entry.currency as Currency,
    date: entry.date.toISOString().slice(0, 10),
    description: entry.description,
    agentUserId: entry.agentUserId,
    agentName: userName(entry.agentUser),
    propertyId: entry.propertyId,
    propertyAddress: entry.property?.address ?? null,
    agentPercentage: entry.agentPercentage,
    agentShareType: (entry.agentShareType as "percent" | "amount") ?? "percent",
    isShared: entry.isShared,
    attachments: entry.attachments ?? null,
    createdByUserId: entry.createdByUserId,
    createdByName: userName(entry.createdByUser),
    createdAt: entry.createdAt.toISOString(),
  };
}

function mapRental(tx: Prisma.RentalPaymentTransactionGetPayload<{ include: typeof rentalInclude }>): AccountMovement {
  const contract = tx.dueDate.contract;
  return {
    id: `rental:${tx.id}`,
    source: "rental_commission",
    type: "income",
    categoryId: RENTAL_COMMISSION_CATEGORY_ID,
    categoryName: "Comisión de alquiler",
    categoryColor: "#10b981",
    amount: tx.commissionAmount,
    currency: (contract.currency as Currency) ?? "ARS",
    date: fromJSDate(tx.paidAt).toISODate() ?? tx.paidAt.toISOString().slice(0, 10),
    description: `Comisión de pago de alquiler${contract.property?.address ? ` · ${contract.property.address}` : ""}`,
    agentUserId: tx.createdByUserId,
    agentName: userName(tx.createdByUser),
    propertyId: contract.property?.id ?? null,
    propertyAddress: contract.property?.address ?? null,
    agentPercentage: null,
    agentShareType: "percent",
    isShared: false,
    attachments: null,
    createdByUserId: tx.createdByUserId,
    createdByName: userName(tx.createdByUser),
    createdAt: tx.createdAt.toISOString(),
  };
}

/** Gasto personal de Costear → AccountMovement (solo lectura, source "costear"). */
function mapCostear(e: CostearExpense): AccountMovement {
  return {
    id: `costear:${e.id}`,
    source: "costear",
    type: "expense",
    categoryId: null,
    categoryName: e.title?.trim() || e.merchant?.trim() || "Gasto personal",
    categoryColor: null,
    amount: e.amountMinor / 100,
    currency: e.currency as Currency,
    date: e.spentAt.slice(0, 10),
    description: [e.merchant, e.notes].filter(Boolean).join(" · ") || null,
    agentUserId: null,
    agentName: null,
    propertyId: null,
    propertyAddress: null,
    agentPercentage: null,
    agentShareType: "percent",
    isShared: false,
    attachments: null,
    createdByUserId: "",
    createdByName: null,
    createdAt: e.createdAt,
  };
}

/**
 * ¿Corresponde traer gastos de Costear con estos filtros? Solo si se pidió
 * (dueña) y los filtros no descartan gastos personales de egreso.
 */
function shouldIncludeCostear(filters: MovementFilters, includeCostear: boolean): boolean {
  if (!includeCostear) return false;
  if (filters.source && filters.source !== "costear") return false;
  if (filters.type && filters.type !== "expense") return false;
  if (filters.categoryId) return false; // categorías de negocio no aplican
  if (filters.agentUserId) return false;
  if (filters.isShared === true) return false;
  return true;
}

async function loadCostear(filters: MovementFilters): Promise<AccountMovement[]> {
  try {
    const expenses = await fetchCostearExpenses({
      from: filters.from,
      to: filters.to,
      currency: filters.currency,
    });
    // profitos solo maneja ARS/USD; se descartan otras monedas (raro).
    return expenses.filter((e) => isCurrency(e.currency)).map(mapCostear);
  } catch (err) {
    // Costear caído no debe romper estados-cuenta: se loguea y se sigue.
    console.error("[estados-cuenta] fallo al traer gastos de Costear:", err);
    return [];
  }
}

/**
 * Devuelve los movimientos del rango filtrado (manuales + comisiones de alquiler
 * + gastos personales de Costear si se pidió).
 */
export async function getMovements(
  filters: MovementFilters,
  options: ReportOptions = {}
): Promise<AccountMovement[]> {
  const includeRental = shouldIncludeRental(filters);
  const includeCostear = shouldIncludeCostear(filters, options.includeCostear ?? false);
  const onlyCostear = filters.source === "costear";

  const [manual, rental, costear] = await Promise.all([
    filters.source === "rental_commission" || onlyCostear
      ? Promise.resolve([])
      : prisma.accountEntry.findMany({
          where: manualWhere(filters),
          include: manualInclude,
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        }),
    includeRental && !onlyCostear
      ? prisma.rentalPaymentTransaction.findMany({
          where: rentalWhere(filters),
          include: rentalInclude,
          orderBy: [{ paidAt: "desc" }],
        })
      : Promise.resolve([]),
    includeCostear ? loadCostear(filters) : Promise.resolve([]),
  ]);

  return [...manual.map(mapManual), ...rental.map(mapRental), ...costear];
}

/**
 * Saldo neto acumulado (ingreso - egreso) ANTERIOR al inicio del rango, por moneda.
 * Solo tiene sentido cuando hay `from`; si no, devuelve {} (saldo inicial 0).
 */
async function getOpeningBalances(filters: MovementFilters): Promise<OpeningByCurrency> {
  if (!filters.from) return {};

  const opening: OpeningByCurrency = {};
  const add = (currency: Currency, delta: number) => {
    opening[currency] = (opening[currency] ?? 0) + delta;
  };

  const tasks: Promise<void>[] = [];

  if (filters.source !== "rental_commission") {
    tasks.push(
      prisma.accountEntry
        .groupBy({
          by: ["currency", "type"],
          where: manualWhere(filters, true),
          _sum: { amount: true },
        })
        .then((rows) => {
          for (const row of rows) {
            const amount = row._sum.amount ?? 0;
            add(row.currency as Currency, row.type === "income" ? amount : -amount);
          }
        })
    );
  }

  if (shouldIncludeRental(filters)) {
    tasks.push(
      prisma.rentalPaymentTransaction
        .findMany({
          where: rentalWhere(filters, true),
          select: {
            commissionAmount: true,
            dueDate: { select: { contract: { select: { currency: true } } } },
          },
        })
        .then((rows) => {
          for (const row of rows) {
            const currency = (row.dueDate.contract.currency as Currency) ?? "ARS";
            add(currency, row.commissionAmount); // comisiones = ingreso
          }
        })
    );
  }

  await Promise.all(tasks);
  return opening;
}

/**
 * Reporte completo: lista de movimientos + desglose por moneda con saldo acumulado.
 */
export async function getAccountReport(
  filters: MovementFilters,
  options: ReportOptions = {}
): Promise<AccountReport> {
  const [movements, opening] = await Promise.all([
    getMovements(filters, options),
    getOpeningBalances(filters),
  ]);
  const currencies: Currency[] = filters.currency ? [filters.currency] : CURRENCIES;
  return buildReport(movements, opening, currencies);
}
