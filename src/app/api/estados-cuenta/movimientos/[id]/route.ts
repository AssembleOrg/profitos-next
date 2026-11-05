import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { validateEntry, type EntryBody } from "@/lib/account/validate";
import { settlePending } from "@/lib/account/entries";
import { isWithinEditWindow, EDIT_WINDOW_HOURS } from "@/lib/account";

/**
 * Edita un movimiento manual.
 * - Solo movimientos manuales (las comisiones de alquiler no son editables).
 * - Cobrados: solo dentro de las 72 hs de creados (o de cobrados).
 * - Pendientes (a cobrar / a pagar): `collect: true` registra el cobro o pago
 *   (total, o parcial con `keepRest`). Sin `collect` se editan, salvo los que
 *   vienen de una firma (esos se cambian desde la firma).
 */
export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const existing = await prisma.accountEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Movimiento no encontrado");
  const body = (await request.json()) as EntryBody & { collect?: boolean; keepRest?: boolean };
  const isPending = existing.status === "pending";

  if (isPending && body.collect === true) {
    const data = await validateEntry(body);
    const saved = await settlePending(existing, data, body.keepRest === true);
    return ok(saved, existing.type === "income" ? "Cobro registrado" : "Pago registrado", path);
  }

  if (isPending) {
    if (existing.signatureProposalId) {
      throw new AppError(400, "Los honorarios de una firma se cambian desde la firma; acá solo se registran como cobrados");
    }
    // Un pendiente no tiene bolsillo hasta que se cobra/paga.
    const data = await validateEntry({ ...body, fund: null, fundUserId: null });
    if (data.type !== existing.type) throw new AppError(400, "Un pendiente no puede cambiar de ingreso a egreso");
    const updated = await prisma.accountEntry.update({ where: { id }, data });
    return ok(updated, "Pendiente actualizado", path);
  }

  if (!isWithinEditWindow(existing.collectedAt ?? existing.createdAt)) {
    throw new AppError(403, `Los movimientos no se pueden editar pasadas ${EDIT_WINDOW_HOURS} hs de su creación`);
  }
  const data = await validateEntry(body);
  const updated = await prisma.accountEntry.update({ where: { id }, data });
  return ok(updated, "Movimiento actualizado correctamente", path);
});

/**
 * Borra un movimiento manual. Cobrados: solo admin. Pendientes cargados a mano:
 * admin o quien los cargó. Los de una firma se quitan desde la firma.
 */
export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const existing = await prisma.accountEntry.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Movimiento no encontrado");
  if (existing.status === "pending") {
    if (existing.signatureProposalId) {
      throw new AppError(400, "Los honorarios a cobrar se quitan desde la firma (sacando el valor o rechazándola)");
    }
    if (!auth.isAdmin && existing.createdByUserId !== auth.userId) {
      throw new AppError(403, "Solo un administrador o quien lo cargó puede borrar este pendiente");
    }
  } else if (!auth.isAdmin) {
    throw new AppError(403, "Solo un administrador puede borrar movimientos");
  }

  await prisma.accountEntry.delete({ where: { id } });
  return ok({ id }, "Movimiento borrado correctamente", path);
});
