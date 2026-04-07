import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getAccessibleContactFollowUpOrThrow } from "@/lib/api/contact-followups";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  await getAccessibleContactFollowUpOrThrow(id, auth);

  const followUp = await prisma.contactFollowUp.findUnique({
    where: { id },
    include: {
      recentContact: true,
      assignedToUser: { select: { id: true, email: true, fullName: true } },
      assignedByUser: { select: { id: true, email: true, fullName: true } },
      actions: {
        include: {
          createdByUser: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: [{ actionAt: "desc" }, { createdAt: "desc" }],
      },
      statusChanges: {
        include: {
          changedByUser: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });

  if (!followUp) throw new AppError(404, "Seguimiento de consulta no encontrado");
  return ok(followUp, "Seguimiento de consulta obtenido", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  await getAccessibleContactFollowUpOrThrow(id, auth);

  const body = await request.json();
  const notes = body?.notes !== undefined ? String(body.notes ?? "").trim() : undefined;
  const assignedToUserId =
    body?.assignedToUserId !== undefined ? String(body.assignedToUserId ?? "").trim() || null : undefined;

  if (!auth.isAdmin && assignedToUserId !== undefined) {
    throw new AppError(403, "Solo administradores pueden reasignar");
  }

  if (assignedToUserId !== undefined && assignedToUserId) {
    const target = await prisma.user.findUnique({
      where: { id: assignedToUserId },
      select: { id: true },
    });
    if (!target) throw new AppError(404, "Usuario asignado no encontrado");
  }

  const updated = await prisma.contactFollowUp.update({
    where: { id },
    data: {
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(assignedToUserId !== undefined
        ? {
            assignedToUserId,
            assignedByUserId: assignedToUserId ? auth.userId : null,
          }
        : {}),
    },
    include: {
      recentContact: true,
      assignedToUser: { select: { id: true, email: true, fullName: true } },
      assignedByUser: { select: { id: true, email: true, fullName: true } },
      _count: { select: { actions: true, statusChanges: true } },
    },
  });

  return ok(updated, "Seguimiento de consulta actualizado", path);
});

