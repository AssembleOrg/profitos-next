import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getAccessibleContactFollowUpOrThrow } from "@/lib/api/contact-followups";
import type { Prisma } from "@/generated/prisma/client";

const ALLOWED_ACTION_TYPES = new Set([
  "nota",
  "whatsapp",
  "email",
  "llamada",
  "audio",
  "sin_respuesta",
  "otro",
]);

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  await getAccessibleContactFollowUpOrThrow(id, auth);

  const actions = await prisma.contactFollowUpAction.findMany({
    where: { followUpId: id },
    include: {
      createdByUser: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: [{ actionAt: "desc" }, { createdAt: "desc" }],
  });

  return ok(actions, "Acciones del seguimiento obtenidas", path);
});

export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  await getAccessibleContactFollowUpOrThrow(id, auth);

  const body = await request.json();
  const type = String(body?.type ?? "nota").trim().toLowerCase();
  const description = String(body?.description ?? "").trim();
  const audioUrlRaw = String(body?.audioUrl ?? "").trim();
  const actionAtRaw = String(body?.actionAt ?? "").trim();
  const attachments = body?.attachments;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!ALLOWED_ACTION_TYPES.has(type)) {
    throw new AppError(400, "Tipo de acción inválido");
  }
  if (!description && !hasAttachments) {
    throw new AppError(400, "La acción no puede estar vacía (texto o adjuntos)");
  }

  const actionAt = actionAtRaw ? new Date(actionAtRaw) : new Date();
  if (Number.isNaN(actionAt.getTime())) {
    throw new AppError(400, "La fecha/hora de acción es inválida");
  }

  const action = await prisma.contactFollowUpAction.create({
    data: {
      followUpId: id,
      type,
      description,
      audioUrl: audioUrlRaw || null,
      attachments: hasAttachments ? (attachments as Prisma.InputJsonValue) : undefined,
      actionAt,
      createdByUserId: auth.userId,
    },
    include: {
      createdByUser: { select: { id: true, fullName: true, email: true } },
    },
  });

  return created(action, "Acción registrada en el seguimiento", path);
});

