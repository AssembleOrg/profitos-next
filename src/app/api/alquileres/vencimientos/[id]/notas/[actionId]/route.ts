import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id, actionId } = await context!.params;

  const action = await prisma.rentalDueDateAction.findUnique({
    where: { id: actionId },
    select: { id: true, dueDateId: true, createdByUserId: true, type: true },
  });
  if (!action || action.dueDateId !== id) throw new AppError(404, "Acción no encontrada");
  if (action.type !== "nota") throw new AppError(400, "Solo se pueden eliminar notas");
  if (!auth.isAdmin && action.createdByUserId !== auth.userId) {
    throw new AppError(403, "Solo el admin o el autor pueden eliminar la nota");
  }

  await prisma.rentalDueDateAction.delete({ where: { id: actionId } });
  return ok(null, "Nota eliminada", path);
});
