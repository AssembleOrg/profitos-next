// ────────────────────────────────────────────────────────────────────
// Alta de movimientos con estado (cobrado / a cobrar / a pagar) y planes
// de cuotas, y registro del cobro/pago de un pendiente (total o parcial).
// ────────────────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import { DateTime } from "@/lib/datetime";
import type { AccountEntry } from "@/generated/prisma/client";
import { splitInstallments } from "./funds";
import type { ValidatedEntry } from "./validate";

export const MAX_INSTALLMENTS = 36;

export interface PlanBody {
  /** true = queda pendiente (a cobrar / a pagar). */
  pending?: boolean;
  /** Cantidad de cuotas (1 = sin cuotas). */
  installments?: number;
  /** Meses entre cuotas (default 1). */
  everyMonths?: number;
  /** En cuotas: la primera ya se cobró/pagó hoy. */
  firstCollected?: boolean;
}

export interface Plan {
  pending: boolean;
  count: number;
  everyMonths: number;
  firstCollected: boolean;
}

export function parsePlan(raw: PlanBody | undefined): Plan {
  const count = raw?.installments ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new AppError(400, `Las cuotas tienen que ser entre 1 y ${MAX_INSTALLMENTS}`);
  }
  const every = raw?.everyMonths ?? 1;
  if (!Number.isInteger(every) || every < 1 || every > 12) {
    throw new AppError(400, "La frecuencia de las cuotas tiene que ser entre 1 y 12 meses");
  }
  return {
    pending: raw?.pending === true,
    count,
    everyMonths: every,
    firstCollected: raw?.firstCollected === true,
  };
}

/** Suma meses a una fecha contable (UTC 00:00), recortando a fin de mes. */
function addMonths(date: Date, months: number): Date {
  return DateTime.fromJSDate(date, { zone: "utc" }).plus({ months }).toJSDate();
}

/**
 * Crea el movimiento (o el plan de cuotas). Los pendientes no tienen bolsillo
 * hasta que se cobran/pagan.
 */
export async function createEntries(data: ValidatedEntry, plan: Plan, userId: string): Promise<AccountEntry[]> {
  const collectedNow = (i: number) => (plan.count === 1 ? !plan.pending : i === 0 && plan.firstCollected);
  if (collectedNow(0) && !data.fund) throw new AppError(400, "Indicá dónde entró o de dónde salió la plata");

  if (plan.count === 1) {
    const pending = !collectedNow(0);
    const entry = await prisma.accountEntry.create({
      data: {
        ...data,
        ...(pending ? { status: "pending", fund: null, fundUserId: null } : {}),
        createdByUserId: userId,
      },
    });
    return [entry];
  }

  const amounts = splitInstallments(data.amount, plan.count);
  // Comisión de agente en monto fijo: se reparte igual que el total.
  const agentShares =
    data.agentShareType === "amount" && data.agentPercentage != null
      ? splitInstallments(data.agentPercentage, plan.count)
      : null;
  const group = randomUUID();
  return prisma.$transaction(
    amounts.map((amount, i) => {
      const collected = collectedNow(i);
      return prisma.accountEntry.create({
        data: {
          ...data,
          amount,
          agentPercentage: agentShares ? agentShares[i] : data.agentPercentage,
          date: addMonths(data.date, i * plan.everyMonths),
          status: collected ? "collected" : "pending",
          fund: collected ? data.fund : null,
          fundUserId: collected ? data.fundUserId : null,
          installmentGroup: group,
          installmentNumber: i + 1,
          installmentCount: plan.count,
          createdByUserId: userId,
        },
      });
    })
  );
}

/**
 * Registra el cobro (a cobrar) o el pago (a pagar) de un pendiente.
 * - Monto igual o mayor: el pendiente pasa a cobrado con los datos confirmados.
 * - Monto menor y `keepRest`: se registra lo cobrado y el resto sigue pendiente.
 */
export async function settlePending(
  existing: AccountEntry,
  data: ValidatedEntry,
  keepRest: boolean
): Promise<AccountEntry> {
  if (data.type !== existing.type) {
    throw new AppError(
      400,
      existing.type === "income" ? "Lo cobrado tiene que ir a una categoría de ingreso" : "Lo pagado tiene que ir a una categoría de egreso"
    );
  }
  if (data.currency !== existing.currency) throw new AppError(400, "La moneda no puede cambiar al cobrar o pagar");
  if (!data.fund) {
    throw new AppError(400, existing.type === "income" ? "Indicá dónde entró la plata" : "Indicá de dónde salió la plata");
  }
  const linked = {
    signatureProposalId: existing.signatureProposalId,
    installmentGroup: existing.installmentGroup,
    installmentNumber: existing.installmentNumber,
    installmentCount: existing.installmentCount,
  };
  const rest = Math.round((existing.amount - data.amount) * 100) / 100;

  if (keepRest && rest > 0) {
    const [created] = await prisma.$transaction([
      prisma.accountEntry.create({
        data: {
          ...data,
          ...linked,
          status: "collected",
          collectedAt: new Date(),
          createdByUserId: existing.createdByUserId,
        },
      }),
      prisma.accountEntry.update({ where: { id: existing.id }, data: { amount: rest } }),
    ]);
    return created;
  }

  return prisma.accountEntry.update({
    where: { id: existing.id },
    data: { ...data, status: "collected", collectedAt: new Date() },
  });
}
