// ────────────────────────────────────────────────────────────────────
// Caja y pendientes: saldos por bolsillo (caja, banco, personas), plata de
// propietarios sin retirar, a cobrar / a pagar y resumen por persona.
// La caja arranca en 0: solo cuenta lo que tiene bolsillo (cargado desde
// que existe la caja) y los ajustes manuales de saldo.
// ────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma/client";
import { now } from "@/lib/datetime";
import { agentCommissionAmount, CURRENCIES, isCurrency, type AccountMovement, type Currency } from "./index";
import { FUND_LABEL, fundKey, isFundKind, parseFundKey, type FundKind } from "./funds";
import { getPending, userName } from "./server";

export type Money = Record<Currency, number>;

const zero = (): Money => ({ ARS: 0, USD: 0 });
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface FundBalance {
  key: string;
  fund: FundKind;
  userId: string | null;
  label: string;
  balance: Money;
}

export interface OwnerPendingItem {
  transactionId: string;
  contractId: string;
  propertyAddress: string | null;
  unit: string | null;
  ownerName: string | null;
  tenantName: string | null;
  /** Fecha del cobro al inquilino (ISO). */
  paidAt: string;
  /** Vencimiento al que corresponde (YYYY-MM-DD). */
  dueDate: string;
  amount: number;
  currency: Currency;
  fund: "caja" | "banco";
}

export interface CounterpartySummary {
  name: string;
  /** Lo que se le debe (a pagar pendiente). */
  pending: Money;
  /** Lo que se le pagó este mes y el mes pasado (incluye comisiones de agente). */
  paidThisMonth: Money;
  paidLastMonth: Money;
}

export interface TransferItem {
  id: string;
  kind: "transfer" | "adjust";
  fromKey: string | null;
  fromLabel: string | null;
  toKey: string;
  toLabel: string;
  amount: number;
  currency: Currency;
  date: string;
  description: string | null;
  createdByName: string | null;
}

export interface PersonOption {
  id: string;
  name: string;
}

export interface CashOverview {
  /** Bolsillos visibles: caja siempre; banco y personas solo admin. */
  funds: FundBalance[];
  /** Plata de propietarios que todavía no retiraron (está dentro de los bolsillos). */
  ownerPending: OwnerPendingItem[];
  ownerPendingTotal: Money;
  /** De lo de propietarios, cuánto está en la caja. */
  ownerPendingInCaja: Money;
  receivables: AccountMovement[];
  payables: AccountMovement[];
  receivableTotal: Money;
  payableTotal: Money;
  /** Cuánto de lo a cobrar ya venció (fecha anterior a hoy). */
  receivableOverdue: Money;
  counterparties: CounterpartySummary[];
  /** Últimos retiros / movimientos entre bolsillos (solo admin). */
  transfers: TransferItem[];
  people: PersonOption[];
  isAdmin: boolean;
  today: string;
}

function add(map: Map<string, Money>, key: string, currency: string, delta: number) {
  if (!isCurrency(currency)) return;
  const cur = map.get(key) ?? zero();
  cur[currency] = round2(cur[currency] + delta);
  map.set(key, cur);
}

function sumBy(items: { amount: number; currency: Currency }[]): Money {
  const total = zero();
  for (const i of items) total[i.currency] = round2(total[i.currency] + i.amount);
  return total;
}

/** Saldos por bolsillo (clave fundKey) de todo lo que tiene bolsillo. */
export async function getFundBalances(): Promise<Map<string, Money>> {
  const [entries, transfers, rentals] = await Promise.all([
    prisma.accountEntry.findMany({
      where: { status: "collected", fund: { not: null } },
      select: {
        type: true,
        amount: true,
        currency: true,
        fund: true,
        fundUserId: true,
        agentUserId: true,
        agentPercentage: true,
        agentShareType: true,
      },
    }),
    prisma.cashTransfer.findMany({
      select: { fromFund: true, fromUserId: true, toFund: true, toUserId: true, amount: true, currency: true },
    }),
    prisma.rentalPaymentTransaction.findMany({
      where: { fund: { not: null } },
      select: {
        amountPaid: true,
        ownerAmount: true,
        fund: true,
        ownerPaidAt: true,
        ownerPaidFund: true,
        dueDate: { select: { contract: { select: { currency: true } } } },
      },
    }),
  ]);

  const map = new Map<string, Money>();
  for (const e of entries) {
    if (!isFundKind(e.fund)) continue;
    const key = fundKey(e.fund, e.fundUserId);
    add(map, key, e.currency, e.type === "income" ? e.amount : -e.amount);
    if (e.type === "income") {
      // La comisión del agente sale del mismo bolsillo donde entró el ingreso.
      const commission = agentCommissionAmount({
        amount: e.amount,
        agentUserId: e.agentUserId,
        agentPercentage: e.agentPercentage,
        agentShareType: e.agentShareType === "amount" ? "amount" : "percent",
      });
      if (commission > 0) add(map, key, e.currency, -commission);
    }
  }
  for (const t of transfers) {
    if (t.fromFund && isFundKind(t.fromFund)) add(map, fundKey(t.fromFund, t.fromUserId), t.currency, -t.amount);
    if (isFundKind(t.toFund)) add(map, fundKey(t.toFund, t.toUserId), t.currency, t.amount);
  }
  for (const r of rentals) {
    const currency = r.dueDate.contract.currency;
    if (isFundKind(r.fund)) add(map, r.fund, currency, r.amountPaid);
    if (r.ownerPaidAt && isFundKind(r.ownerPaidFund)) add(map, r.ownerPaidFund, currency, -r.ownerAmount);
  }
  return map;
}

export async function getOwnerPending(): Promise<OwnerPendingItem[]> {
  const rows = await prisma.rentalPaymentTransaction.findMany({
    where: { ownerPaidAt: null, fund: { not: null }, ownerAmount: { gt: 0 } },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      paidAt: true,
      ownerAmount: true,
      fund: true,
      dueDate: {
        select: {
          dueDate: true,
          contract: {
            select: {
              id: true,
              currency: true,
              unit: true,
              property: { select: { address: true } },
              owner: { select: { fullName: true } },
              tenant: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });
  return rows.map((r) => {
    const c = r.dueDate.contract;
    return {
      transactionId: r.id,
      contractId: c.id,
      propertyAddress: c.property?.address ?? null,
      unit: c.unit,
      ownerName: c.owner?.fullName ?? null,
      tenantName: c.tenant?.fullName ?? null,
      paidAt: r.paidAt.toISOString(),
      dueDate: r.dueDate.dueDate.toISOString().slice(0, 10),
      amount: r.ownerAmount,
      currency: isCurrency(c.currency) ? c.currency : "ARS",
      fund: r.fund === "banco" ? "banco" : "caja",
    };
  });
}

/** Resumen por persona: a pagar pendiente y lo pagado este mes / el pasado. */
async function getCounterparties(payables: AccountMovement[], today: string): Promise<CounterpartySummary[]> {
  const t = now();
  const thisMonth = t.startOf("month").toISODate()!.slice(0, 7);
  const lastMonth = t.minus({ months: 1 }).startOf("month").toISODate()!.slice(0, 7);
  const from = new Date(`${lastMonth}-01T00:00:00.000Z`);
  const to = new Date(`${today}T00:00:00.000Z`);

  const [paid, agentIncomes] = await Promise.all([
    prisma.accountEntry.findMany({
      where: { status: "collected", type: "expense", counterparty: { not: null }, date: { gte: from, lte: to } },
      select: { counterparty: true, amount: true, currency: true, date: true },
    }),
    prisma.accountEntry.findMany({
      where: {
        status: "collected",
        type: "income",
        agentUserId: { not: null },
        agentPercentage: { gt: 0 },
        date: { gte: from, lte: to },
      },
      select: {
        amount: true,
        currency: true,
        date: true,
        agentUserId: true,
        agentPercentage: true,
        agentShareType: true,
        agentUser: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  const byName = new Map<string, CounterpartySummary>();
  const get = (name: string) => {
    const k = name.trim().toLowerCase();
    let s = byName.get(k);
    if (!s) {
      s = { name: name.trim(), pending: zero(), paidThisMonth: zero(), paidLastMonth: zero() };
      byName.set(k, s);
    }
    return s;
  };
  const addPaid = (name: string, currency: string, amount: number, date: Date) => {
    if (!isCurrency(currency)) return;
    const month = date.toISOString().slice(0, 7);
    const s = get(name);
    if (month === thisMonth) s.paidThisMonth[currency] = round2(s.paidThisMonth[currency] + amount);
    else if (month === lastMonth) s.paidLastMonth[currency] = round2(s.paidLastMonth[currency] + amount);
  };

  for (const p of payables) {
    if (!p.counterparty) continue;
    const s = get(p.counterparty);
    s.pending[p.currency] = round2(s.pending[p.currency] + p.amount);
  }
  for (const e of paid) addPaid(e.counterparty!, e.currency, e.amount, e.date);
  for (const e of agentIncomes) {
    const name = userName(e.agentUser);
    if (!name) continue;
    const commission = agentCommissionAmount({
      amount: e.amount,
      agentUserId: e.agentUserId,
      agentPercentage: e.agentPercentage,
      agentShareType: e.agentShareType === "amount" ? "amount" : "percent",
    });
    if (commission > 0) addPaid(name, e.currency, commission, e.date);
  }

  const any = (m: Money) => m.ARS !== 0 || m.USD !== 0;
  return [...byName.values()]
    .filter((s) => any(s.pending) || any(s.paidThisMonth) || any(s.paidLastMonth))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

async function getTransfers(peopleById: Map<string, string>): Promise<TransferItem[]> {
  const rows = await prisma.cashTransfer.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30 });
  const label = (fund: string | null, userId: string | null) => {
    if (!isFundKind(fund)) return null;
    return fund === "persona" ? peopleById.get(userId ?? "") ?? "Persona" : FUND_LABEL[fund];
  };
  return rows
    .filter((r) => isFundKind(r.toFund) && isCurrency(r.currency))
    .map((r) => ({
      id: r.id,
      kind: r.kind === "adjust" ? "adjust" : "transfer",
      fromKey: isFundKind(r.fromFund) ? fundKey(r.fromFund, r.fromUserId) : null,
      fromLabel: label(r.fromFund, r.fromUserId),
      toKey: fundKey(r.toFund as FundKind, r.toUserId),
      toLabel: label(r.toFund, r.toUserId) ?? "",
      amount: r.amount,
      currency: r.currency as Currency,
      date: r.date.toISOString().slice(0, 10),
      description: r.description,
      createdByName: peopleById.get(r.createdByUserId) ?? null,
    }));
}

export async function getPeople(): Promise<PersonOption[]> {
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true },
    orderBy: [{ fullName: "asc" }, { email: "asc" }],
  });
  return users.map((u) => ({ id: u.id, name: userName(u) ?? u.email }));
}

export async function getCashOverview({ isAdmin }: { isAdmin: boolean }): Promise<CashOverview> {
  const today = now().toISODate()!;
  const [balances, ownerPending, receivables, payables, people] = await Promise.all([
    getFundBalances(),
    getOwnerPending(),
    getPending("income"),
    getPending("expense"),
    getPeople(),
  ]);
  const peopleById = new Map(people.map((p) => [p.id, p.name]));

  const funds: FundBalance[] = [
    { key: "caja", fund: "caja", userId: null, label: FUND_LABEL.caja, balance: balances.get("caja") ?? zero() },
  ];
  if (isAdmin) {
    funds.push({ key: "banco", fund: "banco", userId: null, label: FUND_LABEL.banco, balance: balances.get("banco") ?? zero() });
    for (const [key, balance] of balances) {
      const parsed = parseFundKey(key);
      if (parsed?.fund !== "persona" || !parsed.userId) continue;
      if (balance.ARS === 0 && balance.USD === 0) continue;
      funds.push({ key, fund: "persona", userId: parsed.userId, label: peopleById.get(parsed.userId) ?? "Persona", balance });
    }
  }

  const ownerPendingInCaja = sumBy(ownerPending.filter((o) => o.fund === "caja"));
  const [counterparties, transfers] = await Promise.all([
    getCounterparties(payables, today),
    isAdmin ? getTransfers(peopleById) : Promise.resolve([]),
  ]);

  return {
    funds,
    ownerPending: isAdmin ? ownerPending : ownerPending.filter((o) => o.fund === "caja"),
    ownerPendingTotal: isAdmin ? sumBy(ownerPending) : ownerPendingInCaja,
    ownerPendingInCaja,
    receivables,
    payables,
    receivableTotal: sumBy(receivables),
    payableTotal: sumBy(payables),
    receivableOverdue: sumBy(receivables.filter((r) => r.date < today)),
    counterparties,
    transfers,
    people,
    isAdmin,
    today,
  };
}

export { CURRENCIES };
