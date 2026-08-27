// Persistencia de preguntas de ML en jp_portal_questions (leads).
import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "./config";
import type { MlQuestion } from "./items";

// Upsert de una pregunta de ML, resolviendo la propiedad vía la publicación.
export async function upsertPortalQuestion(q: MlQuestion) {
  const publication = await prisma.propertyPublication.findFirst({
    where: { portal: ML_PORTAL, externalId: q.item_id },
    select: { propertyId: true },
  });
  const data = {
    portal: ML_PORTAL,
    itemId: q.item_id,
    propertyId: publication?.propertyId ?? null,
    text: q.text ?? "",
    status: q.answer?.text ? "ANSWERED" : q.status ?? "UNANSWERED",
    answerText: q.answer?.text ?? null,
    fromUserId: q.from?.id != null ? String(q.from.id) : null,
    askedAt: q.date_created ? new Date(q.date_created) : null,
    answeredAt: q.answer?.date_created ? new Date(q.answer.date_created) : null,
    rawPayload: q as object,
  };
  return prisma.portalQuestion.upsert({
    where: { portal_externalId: { portal: ML_PORTAL, externalId: String(q.id) } },
    create: { externalId: String(q.id), ...data },
    update: data,
  });
}
