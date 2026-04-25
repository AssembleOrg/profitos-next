import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin, getAccessibleItemOrThrow } from "@/lib/api/objectives";
import { isItemStatus } from "@/lib/objectives";

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id, itemId } = await context!.params;

  await getAccessibleItemOrThrow(id, itemId, auth);

  const body = await request.json();
  const { text, status } = body as { text?: string; status?: string };

  // Editing the text is admin-only; toggling status is allowed for both admin and assignee.
  if (text !== undefined && !auth.isAdmin) {
    throw new AppError(403, "Solo un administrador puede editar el texto");
  }

  const data: Record<string, unknown> = {};
  if (text !== undefined) {
    if (!text.trim()) throw new AppError(400, "El texto no puede estar vacío");
    data.text = text.trim();
  }
  if (status !== undefined) {
    if (!isItemStatus(status)) throw new AppError(400, "Estado de ítem inválido");
    data.status = status;
    data.evaluatedByUserId = auth.userId;
    data.evaluatedAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    throw new AppError(400, "Sin cambios para aplicar");
  }

  const updated = await prisma.objectiveItem.update({
    where: { id: itemId },
    data,
    include: {
      evaluatedByUser: { select: { id: true, email: true, fullName: true } },
    },
  });

  return ok(updated, "Ítem actualizado correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id, itemId } = await context!.params;

  await getAccessibleItemOrThrow(id, itemId, auth);

  await prisma.objectiveItem.delete({ where: { id: itemId } });
  return ok(null, "Ítem eliminado correctamente", path);
});
