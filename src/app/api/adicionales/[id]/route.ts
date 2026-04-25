import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/api/followups";

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id } = await context!.params;

  const additional = await prisma.rentalAdditional.findUnique({ where: { id }, select: { id: true } });
  if (!additional) throw new AppError(404, "Adicional no encontrado");

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) throw new AppError(400, "El nombre no puede estar vacío");
    data.name = body.name.trim();
  }
  if ("defaultAmount" in body) {
    const value = body.defaultAmount;
    data.defaultAmount =
      typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  if ("notes" in body) data.notes = body.notes?.trim() || null;

  const updated = await prisma.rentalAdditional.update({ where: { id }, data });
  return ok(updated, "Adicional actualizado correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id } = await context!.params;

  const additional = await prisma.rentalAdditional.findUnique({
    where: { id },
    select: { id: true, _count: { select: { contracts: true } } },
  });
  if (!additional) throw new AppError(404, "Adicional no encontrado");
  if (additional._count.contracts > 0) {
    throw new AppError(400, "No se puede eliminar: el adicional está en uso por contratos");
  }

  await prisma.rentalAdditional.delete({ where: { id } });
  return ok(null, "Adicional eliminado correctamente", path);
});
