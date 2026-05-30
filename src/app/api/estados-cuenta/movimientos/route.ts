import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getAccountReport, type MovementFilters } from "@/lib/account/server";
import { validateEntry, type EntryBody } from "@/lib/account/validate";
import { isCurrency, isEntryType, type MovementSource } from "@/lib/account";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFilters(sp: URLSearchParams): MovementFilters {
  const filters: MovementFilters = {};
  const from = sp.get("from");
  const to = sp.get("to");
  const type = sp.get("type");
  const categoryId = sp.get("categoryId");
  const currency = sp.get("currency");
  const agentUserId = sp.get("agentUserId");
  const source = sp.get("source");

  if (from && DATE_RE.test(from)) filters.from = from;
  if (to && DATE_RE.test(to)) filters.to = to;
  if (isEntryType(type)) filters.type = type;
  if (categoryId) filters.categoryId = categoryId;
  if (isCurrency(currency)) filters.currency = currency;
  if (agentUserId) filters.agentUserId = agentUserId;
  if (source === "manual" || source === "rental_commission") filters.source = source as MovementSource;
  return filters;
}

/**
 * Reporte de estados de cuenta: lista de movimientos (manuales + comisiones de
 * alquiler) y desglose por moneda con saldo acumulado mensual.
 */
export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const report = await getAccountReport(parseFilters(request.nextUrl.searchParams));
  return ok(report, "Estado de cuenta obtenido correctamente", path);
});

/**
 * Crea un movimiento manual. Lo puede crear cualquier usuario.
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const data = await validateEntry((await request.json()) as EntryBody);

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
