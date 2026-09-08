import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

/**
 * Edita una inmobiliaria (nombre, dirección, teléfono).
 */
export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const agency = await prisma.agency.findUnique({ where: { id }, select: { id: true } });
  if (!agency) throw new AppError(404, "Inmobiliaria no encontrada");

  const body = (await request.json()) as { name?: string; address?: string | null; phone?: string | null };
  const data: { name?: string; address?: string | null; phone?: string | null } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) throw new AppError(400, "El nombre no puede quedar vacío");
    const duplicate = await prisma.agency.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new AppError(409, "Ya existe una inmobiliaria con ese nombre");
    data.name = name;
  }
  if ("address" in body) data.address = body.address?.trim() || null;
  if ("phone" in body) data.phone = body.phone?.trim() || null;

  const updated = await prisma.agency.update({ where: { id }, data });
  return ok(updated, "Inmobiliaria actualizada correctamente", path);
});

/**
 * Borra una inmobiliaria. Solo admin y solo si no tiene movimientos asociados.
 */
export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  if (!auth.isAdmin) throw new AppError(403, "Solo un administrador puede borrar inmobiliarias");
  const { id } = await context!.params;

  const agency = await prisma.agency.findUnique({
    where: { id },
    select: { id: true, _count: { select: { entries: true } } },
  });
  if (!agency) throw new AppError(404, "Inmobiliaria no encontrada");
  if (agency._count.entries > 0) {
    throw new AppError(400, `No se puede borrar: tiene ${agency._count.entries} movimiento(s) compartido(s) asociado(s)`);
  }

  await prisma.agency.delete({ where: { id } });
  return ok({ id }, "Inmobiliaria borrada correctamente", path);
});
