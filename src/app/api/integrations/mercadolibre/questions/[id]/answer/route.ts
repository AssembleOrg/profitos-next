import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { answerQuestion } from "@/lib/mercadolibre/items";

// Responde una pregunta de MercadoLibre y refleja la respuesta en la DB.
// id = id local de PortalQuestion.
export const POST = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const { id } = (await context!.params) as { id: string };
  const { text } = (await request.json()) as { text?: string };

  const trimmed = (text ?? "").trim();
  if (!trimmed) throw new AppError(400, "La respuesta no puede estar vacía");

  const question = await prisma.portalQuestion.findUnique({ where: { id } });
  if (!question) throw new AppError(404, "Pregunta no encontrada");
  if (question.status === "ANSWERED") throw new AppError(409, "La pregunta ya está respondida");

  await answerQuestion(question.externalId, trimmed);

  const updated = await prisma.portalQuestion.update({
    where: { id },
    data: { status: "ANSWERED", answerText: trimmed, answeredAt: new Date() },
  });
  return ok(updated, "Respuesta enviada", path);
});
