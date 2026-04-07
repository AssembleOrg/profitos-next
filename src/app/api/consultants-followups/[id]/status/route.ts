import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getAccessibleContactFollowUpOrThrow } from "@/lib/api/contact-followups";

const ALLOWED_STATUSES = new Set(["pendiente", "iniciada", "activa", "cerrada"]);

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const followUp = await getAccessibleContactFollowUpOrThrow(id, auth);
  const body = await request.json();
  const status = String(body?.status ?? "").trim().toLowerCase();
  const note = String(body?.note ?? "").trim();

  if (!ALLOWED_STATUSES.has(status)) {
    throw new AppError(400, "Estado inválido. Permitidos: pendiente, iniciada, activa, cerrada");
  }
  if (!note) {
    throw new AppError(400, "La nota es obligatoria para cambiar el estado");
  }
  if (followUp.status === status) {
    throw new AppError(400, "El seguimiento ya tiene ese estado");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.contactFollowUp.update({
      where: { id },
      data: { status },
      include: {
        recentContact: {
          select: {
            id: true,
            name: true,
            email: true,
            cellphone: true,
            phone: true,
            leadStatus: true,
            agentName: true,
            agentEmail: true,
          },
        },
        assignedToUser: { select: { id: true, email: true, fullName: true } },
        assignedByUser: { select: { id: true, email: true, fullName: true } },
      },
    });

    await tx.contactFollowUpStatusChange.create({
      data: {
        followUpId: id,
        fromStatus: followUp.status,
        toStatus: status,
        note,
        changedByUserId: auth.userId,
      },
    });

    return item;
  });

  return ok(updated, "Estado de seguimiento actualizado", path);
});

