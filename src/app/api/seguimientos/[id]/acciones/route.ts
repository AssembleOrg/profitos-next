import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { getAccessibleFollowUpOrThrow } from "@/lib/api/followups";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  await getAccessibleFollowUpOrThrow(id, auth);

  const actions = await prisma.followUpAction.findMany({
    where: { followUpId: id },
    include: {
      createdByUser: {
        select: { id: true, email: true, fullName: true },
      },
    },
    orderBy: [{ actionAt: "desc" }, { createdAt: "desc" }],
  });

  return ok(actions, "Acciones del seguimiento obtenidas correctamente", path);
});

export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  await getAccessibleFollowUpOrThrow(id, auth);
  const body = await request.json();

  const {
    type,
    description,
    actionAt,
    shownToName,
    scheduledDate,
    scheduledTime,
    metadata,
  } = body as {
    type?: string;
    description?: string;
    actionAt?: string;
    shownToName?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    metadata?: unknown;
  };

  if (!description) throw new AppError(400, "El campo 'description' es obligatorio");
  const parsedMetadata = metadata === undefined || metadata === null ? undefined : metadata;

  const action = await prisma.followUpAction.create({
    data: {
      followUpId: id,
      type: type ?? "nota",
      description,
      actionAt: actionAt ? new Date(actionAt) : new Date(),
      shownToName: shownToName ?? null,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      scheduledTime: scheduledTime ?? null,
      ...(parsedMetadata !== undefined && { metadata: parsedMetadata as never }),
      createdByUserId: auth.userId,
    },
    include: {
      createdByUser: {
        select: { id: true, email: true, fullName: true },
      },
    },
  });

  return created(action, "Acción agregada correctamente", path);
});
