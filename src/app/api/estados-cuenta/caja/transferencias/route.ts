import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { isCurrency } from "@/lib/account";
import { fundKey, parseFundKey } from "@/lib/account/funds";
import { getFundBalances } from "@/lib/account/cash-server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Body {
  /** transfer = mover plata entre bolsillos (retiro, depósito). adjust = fijar el saldo real. */
  kind?: string;
  from?: string;
  to?: string;
  /** transfer: monto a mover. adjust: saldo real que tiene el bolsillo. */
  amount?: number;
  currency?: string;
  date?: string;
  description?: string | null;
}

async function personExists(userId: string | null) {
  if (!userId) return false;
  return (await prisma.user.count({ where: { id: userId } })) > 0;
}

/** Retiro / movimiento entre bolsillos o ajuste de saldo. Solo admin. */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  if (!auth.isAdmin) throw new AppError(403, "Solo un administrador puede mover plata entre bolsillos");
  const body = (await request.json()) as Body;

  const kind = body.kind === "adjust" ? "adjust" : "transfer";
  const to = parseFundKey(body.to);
  if (!to) throw new AppError(400, "Elegí el bolsillo");
  if (to.fund === "persona" && !(await personExists(to.userId))) throw new AppError(400, "La persona elegida no existe");
  if (!isCurrency(body.currency)) throw new AppError(400, "Moneda inválida (ARS/USD)");
  if (!body.date || !DATE_RE.test(body.date)) throw new AppError(400, "Fecha inválida");
  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) throw new AppError(400, "Monto inválido");
  const description = body.description?.trim().slice(0, 300) || null;
  const date = new Date(`${body.date}T00:00:00.000Z`);

  if (kind === "adjust") {
    if (amount < 0) throw new AppError(400, "El saldo real no puede ser negativo");
    const balances = await getFundBalances();
    const current = balances.get(fundKey(to.fund, to.userId))?.[body.currency] ?? 0;
    const delta = Math.round((amount - current) * 100) / 100;
    if (delta === 0) throw new AppError(400, "El saldo ya es ese: no hay nada que ajustar");
    const adjust = await prisma.cashTransfer.create({
      data: {
        kind,
        toFund: to.fund,
        toUserId: to.userId,
        amount: delta,
        currency: body.currency,
        date,
        description: description ?? "Ajuste de saldo",
        createdByUserId: auth.userId,
      },
    });
    return created(adjust, "Saldo ajustado", path);
  }

  if (amount <= 0) throw new AppError(400, "El monto tiene que ser mayor a cero");
  const from = parseFundKey(body.from);
  if (!from) throw new AppError(400, "Elegí de dónde sale la plata");
  if (from.fund === "persona" && !(await personExists(from.userId))) throw new AppError(400, "La persona elegida no existe");
  if (fundKey(from.fund, from.userId) === fundKey(to.fund, to.userId)) {
    throw new AppError(400, "El origen y el destino tienen que ser distintos");
  }
  const transfer = await prisma.cashTransfer.create({
    data: {
      kind,
      fromFund: from.fund,
      fromUserId: from.userId,
      toFund: to.fund,
      toUserId: to.userId,
      amount,
      currency: body.currency,
      date,
      description,
      createdByUserId: auth.userId,
    },
  });
  return created(transfer, "Movimiento registrado", path);
});
