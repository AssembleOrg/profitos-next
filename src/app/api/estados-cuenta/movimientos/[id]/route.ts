import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { validateEntry, type EntryBody } from "@/lib/account/validate";
import { isWithinEditWindow, EDIT_WINDOW_HOURS } from "@/lib/account";

/**
 * Edita un movimiento manual.
 * - Solo movimientos manuales (las comisiones de alquiler no son editables).
 * - Solo dentro de las 72 hs de creado.
 */
export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const existing = await prisma.accountEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Movimiento no encontrado");
  if (!isWithinEditWindow(existing.createdAt)) {
    throw new AppError(403, `Los movimientos no se pueden editar pasadas ${EDIT_WINDOW_HOURS} hs de su creación`);
  }

  const data = await validateEntry((await request.json()) as EntryBody);

  const updated = await prisma.accountEntry.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true, color: true } },
      agentUser: { select: { id: true, fullName: true, email: true } },
      property: { select: { id: true, address: true } },
    },
  });

  return ok(updated, "Movimiento actualizado correctamente", path);
});

/**
 * Borra un movimiento manual. Solo admin.
 */
export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  if (!auth.isAdmin) throw new AppError(403, "Solo un administrador puede borrar movimientos");
  const { id } = await context!.params;

  const existing = await prisma.accountEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Movimiento no encontrado");

  await prisma.accountEntry.delete({ where: { id } });
  return ok({ id }, "Movimiento borrado correctamente", path);
});
