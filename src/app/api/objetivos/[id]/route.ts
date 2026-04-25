import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin, cardInclude, getAccessibleCardOrThrow } from "@/lib/api/objectives";
import { isCardStatus } from "@/lib/objectives";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  await getAccessibleCardOrThrow(id, auth);

  const card = await prisma.objectiveCard.findUnique({
    where: { id },
    include: cardInclude,
  });

  if (!card) throw new AppError(404, "Objetivo no encontrado");
  return ok(card, "Objetivo obtenido correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id } = await context!.params;

  await getAccessibleCardOrThrow(id, auth);

  const body = await request.json();
  const {
    title,
    description,
    startDate,
    endDate,
    statusOverride,
    assignedToUserId,
  } = body as {
    title?: string;
    description?: string | null;
    startDate?: string;
    endDate?: string;
    statusOverride?: string | null;
    assignedToUserId?: string;
  };

  const data: Record<string, unknown> = {};

  if (title !== undefined) {
    if (!title.trim()) throw new AppError(400, "El título no puede estar vacío");
    data.title = title.trim();
  }
  if (description !== undefined) {
    data.description = description?.trim() || null;
  }
  if (startDate !== undefined) {
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) throw new AppError(400, "Fecha de inicio inválida");
    data.startDate = d;
  }
  if (endDate !== undefined) {
    const d = new Date(endDate);
    if (Number.isNaN(d.getTime())) throw new AppError(400, "Fecha de fin inválida");
    data.endDate = d;
  }
  if (statusOverride !== undefined) {
    if (statusOverride === null || statusOverride === "") {
      data.statusOverride = null;
    } else if (isCardStatus(statusOverride)) {
      data.statusOverride = statusOverride;
    } else {
      throw new AppError(400, "Estado inválido");
    }
  }
  if (assignedToUserId !== undefined) {
    const exists = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true } });
    if (!exists) throw new AppError(404, "Empleado no encontrado");
    data.assignedToUserId = assignedToUserId;
  }

  if (data.startDate && data.endDate && (data.startDate as Date) > (data.endDate as Date)) {
    throw new AppError(400, "La fecha de inicio no puede ser posterior a la de fin");
  }

  const updated = await prisma.objectiveCard.update({
    where: { id },
    data,
    include: cardInclude,
  });

  return ok(updated, "Objetivo actualizado correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id } = await context!.params;

  const card = await prisma.objectiveCard.findUnique({ where: { id }, select: { id: true } });
  if (!card) throw new AppError(404, "Objetivo no encontrado");

  await prisma.objectiveCard.delete({ where: { id } });
  return ok(null, "Objetivo eliminado correctamente", path);
});
