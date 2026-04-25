import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin, getAccessibleCardOrThrow } from "@/lib/api/objectives";

export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id } = await context!.params;

  await getAccessibleCardOrThrow(id, auth);

  const body = await request.json();
  const { text } = body as { text?: string };
  if (!text || !text.trim()) throw new AppError(400, "El texto del ítem es obligatorio");

  const last = await prisma.objectiveItem.findFirst({
    where: { cardId: id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const nextPosition = (last?.position ?? -1) + 1;

  const item = await prisma.objectiveItem.create({
    data: {
      cardId: id,
      text: text.trim(),
      position: nextPosition,
    },
    include: {
      evaluatedByUser: { select: { id: true, email: true, fullName: true } },
    },
  });

  return created(item, "Ítem creado correctamente", path);
});
