import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

/** Borra un retiro / movimiento entre bolsillos / ajuste. Solo admin. */
export const DELETE = withHandler(async (request: NextRequest, context) => {
  const auth = await getAuthContext();
  if (!auth.isAdmin) throw new AppError(403, "Solo un administrador puede borrar movimientos de caja");
  const { id } = await context!.params;
  const existing = await prisma.cashTransfer.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Movimiento no encontrado");
  await prisma.cashTransfer.delete({ where: { id } });
  return ok({ id }, "Movimiento borrado", request.nextUrl.pathname);
});
