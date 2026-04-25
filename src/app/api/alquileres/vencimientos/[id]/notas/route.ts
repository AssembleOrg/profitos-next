import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import type { Prisma } from "@/generated/prisma/client";

export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const due = await prisma.rentalDueDate.findUnique({ where: { id }, select: { id: true } });
  if (!due) throw new AppError(404, "Vencimiento no encontrado");

  const body = await request.json();
  const { description, attachments } = body as { description?: string; attachments?: unknown[] };
  const text = description?.trim() ?? "";
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!text && !hasAttachments) {
    throw new AppError(400, "La nota no puede estar vacía (texto o adjuntos)");
  }

  const action = await prisma.rentalDueDateAction.create({
    data: {
      dueDateId: id,
      type: "nota",
      description: text || null,
      attachments: hasAttachments ? (attachments as Prisma.InputJsonValue) : undefined,
      createdByUserId: auth.userId,
    },
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  });

  return created(action, "Nota agregada correctamente", path);
});
