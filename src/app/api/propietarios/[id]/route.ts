import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { parseOwnerBody } from "@/lib/rentals/owners";

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;
  const exists = await prisma.owner.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, "Propietario no encontrado");
  const data = parseOwnerBody((await request.json()) as Record<string, unknown>, true);
  const owner = await prisma.owner.update({ where: { id }, data });
  return ok(owner, "Propietario actualizado", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  if (!auth.isAdmin) throw new AppError(403, "Solo un admin puede eliminar propietarios");
  const { id } = await context!.params;
  const owner = await prisma.owner.findUnique({ where: { id }, include: { _count: { select: { contracts: true } } } });
  if (!owner) throw new AppError(404, "Propietario no encontrado");
  if (owner._count.contracts > 0) throw new AppError(409, "Tiene contratos asociados: quitalo de los contratos primero");
  await prisma.owner.delete({ where: { id } });
  return ok(null, "Propietario eliminado", path);
});
