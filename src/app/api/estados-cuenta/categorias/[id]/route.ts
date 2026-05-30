import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

/**
 * Edita una categoría (nombre, color, archivar/desarchivar).
 * No se puede cambiar el `kind` (rompería los movimientos asociados).
 * Las categorías de sistema no se pueden editar.
 */
export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const category = await prisma.accountCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(404, "Categoría no encontrada");
  if (category.isSystem) throw new AppError(400, "Las categorías de sistema no se pueden editar");

  const body = await request.json();
  const { name, color, archived } = body as { name?: string; color?: string | null; archived?: boolean };

  const data: { name?: string; color?: string | null; archivedAt?: Date | null } = {};

  if (name !== undefined) {
    if (!name.trim()) throw new AppError(400, "El nombre no puede quedar vacío");
    const duplicate = await prisma.accountCategory.findFirst({
      where: { kind: category.kind, name: { equals: name.trim(), mode: "insensitive" }, id: { not: id } },
    });
    if (duplicate) throw new AppError(409, "Ya existe una categoría con ese nombre");
    data.name = name.trim();
  }
  if (color !== undefined) data.color = color?.trim() || null;
  if (archived !== undefined) data.archivedAt = archived ? new Date() : null;

  const updated = await prisma.accountCategory.update({ where: { id }, data });
  return ok(updated, "Categoría actualizada correctamente", path);
});

/**
 * Borra una categoría. Solo admin.
 * - Categorías de sistema: no se pueden borrar.
 * - Categorías con movimientos: se archivan (para no perder el historial).
 * - Sin movimientos: se borran definitivamente.
 */
export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  if (!auth.isAdmin) throw new AppError(403, "Solo un administrador puede borrar categorías");
  const { id } = await context!.params;

  const category = await prisma.accountCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(404, "Categoría no encontrada");
  if (category.isSystem) throw new AppError(400, "Las categorías de sistema no se pueden borrar");

  const usageCount = await prisma.accountEntry.count({ where: { categoryId: id } });
  if (usageCount > 0) {
    const archived = await prisma.accountCategory.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return ok(archived, `La categoría tiene ${usageCount} movimiento(s): se archivó en lugar de borrarse`, path);
  }

  await prisma.accountCategory.delete({ where: { id } });
  return ok({ id }, "Categoría borrada correctamente", path);
});
