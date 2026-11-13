import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { manualInclude, mapManual } from "@/lib/account/server";
import { isAccountArea } from "@/lib/account";
import { getCostearPhoneForEmail } from "@/lib/costear/client";

/**
 * Lo que necesita "Cerrar operación": los honorarios pendientes de la firma
 * (a cobrar y, si cobramos todo, lo que hay que pagarle al colega) y los datos
 * del mismo formulario de cobro de Estados de cuenta.
 */
export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const proposal = await prisma.signatureProposal.findUnique({ where: { id }, select: { id: true } });
  if (!proposal) throw new AppError(404, "Propuesta no encontrada");

  const [pending, categories, users, me] = await Promise.all([
    prisma.accountEntry.findMany({
      where: { signatureProposalId: id, status: "pending" },
      include: manualInclude,
      orderBy: [{ type: "desc" }, { createdAt: "asc" }], // primero "income"
    }),
    prisma.accountCategory.findMany({
      where: { archivedAt: null },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({ select: { id: true, fullName: true, email: true }, orderBy: [{ fullName: "asc" }] }),
    prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } }),
  ]);

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind as "income" | "expense",
    color: c.color,
    isSystem: c.isSystem,
    area: isAccountArea(c.area) ? c.area : null,
  }));
  const people = users.map((u) => ({ id: u.id, name: u.fullName?.trim() || u.email }));

  return ok(
    {
      pendingIncome: pending.filter((e) => e.type === "income").map(mapManual),
      pendingExpense: pending.filter((e) => e.type === "expense").map(mapManual),
      incomeCategories: serializedCategories.filter((c) => c.kind === "income" && !c.isSystem),
      expenseCategories: serializedCategories.filter((c) => c.kind === "expense"),
      agents: people,
      people,
      isCostearOwner: getCostearPhoneForEmail(me?.email) !== null,
    },
    "Datos del cierre",
    path,
  );
});
