import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getAccessibleFollowUpOrThrow, assertAdmin } from "@/lib/api/followups";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  await getAccessibleFollowUpOrThrow(id, auth);

  const followUp = await prisma.propertyFollowUp.findUnique({
    where: { id },
    include: {
      property: {
        select: { id: true, address: true, city: true, zone: true, type: true, status: true },
      },
      assignedToUser: {
        select: { id: true, email: true, fullName: true },
      },
      assignedByUser: {
        select: { id: true, email: true, fullName: true },
      },
      actions: {
        include: {
          createdByUser: {
            select: { id: true, email: true, fullName: true },
          },
        },
        orderBy: [{ actionAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!followUp) throw new AppError(404, "Seguimiento no encontrado");
  return ok(followUp, "Seguimiento obtenido correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  await getAccessibleFollowUpOrThrow(id, auth);
  const body = await request.json();
  const {
    assignedToUserId,
    title,
    notes,
    status,
    dueDate,
  } = body as {
    assignedToUserId?: string;
    title?: string;
    notes?: string;
    status?: string;
    dueDate?: string | null;
  };

  if (!auth.isAdmin && assignedToUserId !== undefined) {
    throw new AppError(403, "Solo un administrador puede reasignar seguimientos");
  }

  if (!auth.isAdmin && title !== undefined) {
    throw new AppError(403, "Solo un administrador puede editar el título");
  }

  // Get current state before update for transfer tracking
  const currentFollowUp = await prisma.propertyFollowUp.findUnique({
    where: { id },
    select: { assignedToUserId: true, assignedToUser: { select: { fullName: true, email: true } } },
  });

  if (assignedToUserId !== undefined) {
    assertAdmin(auth);
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToUserId },
      select: { id: true, fullName: true, email: true },
    });
    if (!assignedUser) throw new AppError(404, "Usuario asignado no encontrado");

    // Log transfer as an action if the assignee actually changed
    if (currentFollowUp && currentFollowUp.assignedToUserId !== assignedToUserId) {
      const fromName = currentFollowUp.assignedToUser?.fullName?.trim() || currentFollowUp.assignedToUser?.email || "Sin asignar";
      const toName = assignedUser.fullName?.trim() || assignedUser.email;
      await prisma.followUpAction.create({
        data: {
          followUpId: id,
          type: "transferencia",
          description: `Seguimiento transferido de ${fromName} a ${toName}`,
          actionAt: new Date(),
          createdByUserId: auth.userId,
          metadata: {
            kind: "transfer",
            fromUserId: currentFollowUp.assignedToUserId,
            fromUserName: fromName,
            toUserId: assignedToUserId,
            toUserName: toName,
          },
        },
      });
    }
  }

  const followUp = await prisma.propertyFollowUp.update({
    where: { id },
    data: {
      ...(assignedToUserId !== undefined && { assignedToUserId }),
      ...(title !== undefined && { title }),
      ...(notes !== undefined && { notes }),
      ...(status !== undefined && { status }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: {
      property: {
        select: { id: true, address: true, city: true, zone: true },
      },
      assignedToUser: {
        select: { id: true, email: true, fullName: true },
      },
      assignedByUser: {
        select: { id: true, email: true, fullName: true },
      },
      _count: {
        select: { actions: true },
      },
    },
  });

  return ok(followUp, "Seguimiento actualizado correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id } = await context!.params;

  const followUp = await prisma.propertyFollowUp.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!followUp) throw new AppError(404, "Seguimiento no encontrado");

  await prisma.propertyFollowUp.delete({ where: { id } });
  return ok(null, "Seguimiento eliminado correctamente", path);
});
