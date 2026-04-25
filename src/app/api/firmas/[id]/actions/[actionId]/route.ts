import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertCanDeleteAction } from "@/lib/api/signatures";

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id, actionId } = await context!.params;

  const action = await prisma.signatureProposalAction.findUnique({
    where: { id: actionId },
    select: { id: true, proposalId: true, createdByUserId: true, type: true },
  });

  if (!action || action.proposalId !== id) throw new AppError(404, "Acción no encontrada");
  if (action.type !== "nota") {
    throw new AppError(400, "Solo se pueden eliminar notas (no eventos de auditoría)");
  }

  assertCanDeleteAction(action, auth);

  await prisma.signatureProposalAction.delete({ where: { id: actionId } });
  return ok(null, "Acción eliminada correctamente", path);
});
