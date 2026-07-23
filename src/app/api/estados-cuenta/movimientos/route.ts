import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getAccountReport, type MovementFilters } from "@/lib/account/server";
import { validateEntry, type EntryBody } from "@/lib/account/validate";
import { isCurrency, isEntryType, type Currency, type MovementSource } from "@/lib/account";
import { createCostearExpense, isCostearOwner } from "@/lib/costear/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFilters(sp: URLSearchParams): MovementFilters {
  const filters: MovementFilters = {};
  const from = sp.get("from");
  const to = sp.get("to");
  const type = sp.get("type");
  const categoryId = sp.get("categoryId");
  const currency = sp.get("currency");
  const agentUserId = sp.get("agentUserId");
  const shared = sp.get("shared");
  const source = sp.get("source");

  if (from && DATE_RE.test(from)) filters.from = from;
  if (to && DATE_RE.test(to)) filters.to = to;
  if (isEntryType(type)) filters.type = type;
  if (categoryId) filters.categoryId = categoryId;
  if (isCurrency(currency)) filters.currency = currency;
  if (agentUserId) filters.agentUserId = agentUserId;
  if (shared === "1") filters.isShared = true;
  else if (shared === "0") filters.isShared = false;
  if (source === "manual" || source === "rental_commission" || source === "costear") {
    filters.source = source as MovementSource;
  }
  return filters;
}

/**
 * Reporte de estados de cuenta: lista de movimientos (manuales + comisiones de
 * alquiler) y desglose por moneda con saldo acumulado mensual.
 */
export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const report = await getAccountReport(parseFilters(request.nextUrl.searchParams), {
    includeCostear: isCostearOwner(auth.email),
  });
  return ok(report, "Estado de cuenta obtenido correctamente", path);
});

interface PersonalExpenseBody {
  personal?: boolean;
  amount?: number;
  currency?: Currency;
  date?: string; // YYYY-MM-DD
  description?: string | null;
}

/**
 * Crea un movimiento. Por defecto es un movimiento manual de la inmobiliaria
 * (jp_account_entries). Si el body trae `personal: true` es un gasto personal
 * de la dueña: NO se guarda en profitos, va directo a Costear.
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const raw = (await request.json()) as EntryBody & PersonalExpenseBody;

  // ── Gasto personal → Costear (no se persiste en profitos) ──
  if (raw.personal === true) {
    if (!isCostearOwner(auth.email)) {
      throw new AppError(403, "No autorizado para crear gastos personales de Costear");
    }
    const amount = Number(raw.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, "Monto inválido");
    if (!isCurrency(raw.currency)) throw new AppError(400, "Moneda inválida");
    if (!raw.date || !DATE_RE.test(raw.date)) throw new AppError(400, "Fecha inválida");
    const title = raw.description?.trim();
    if (!title) throw new AppError(400, "Ingresá una descripción para el gasto");

    const expense = await createCostearExpense({
      title,
      amountMinor: Math.round(amount * 100),
      currency: raw.currency,
      // Fecha contable a mediodía UTC para evitar corrimiento de día por zona.
      spentAt: `${raw.date}T12:00:00.000Z`,
    });

    return created({ source: "costear", id: expense.id }, "Gasto personal registrado en Costear", path);
  }

  // ── Movimiento normal de la inmobiliaria ──
  const data = await validateEntry(raw);

  const entry = await prisma.accountEntry.create({
    data: { ...data, createdByUserId: auth.userId },
    include: {
      category: { select: { id: true, name: true, color: true } },
      agentUser: { select: { id: true, fullName: true, email: true } },
      property: { select: { id: true, address: true } },
    },
  });

  return created(entry, "Movimiento registrado correctamente", path);
});
