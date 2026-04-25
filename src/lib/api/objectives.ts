import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/api/auth";

export { assertAdmin } from "@/lib/api/followups";

export const cardInclude = {
  assignedToUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
  createdByUser: { select: { id: true, email: true, fullName: true } },
  items: {
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      evaluatedByUser: { select: { id: true, email: true, fullName: true } },
    },
  },
} satisfies Prisma.ObjectiveCardInclude;

export async function getAccessibleCardOrThrow(cardId: string, auth: AuthContext) {
  const card = await prisma.objectiveCard.findUnique({
    where: { id: cardId },
    select: { id: true, assignedToUserId: true },
  });

  if (!card) throw new AppError(404, "Objetivo no encontrado");

  if (!auth.isAdmin && card.assignedToUserId !== auth.userId) {
    throw new AppError(404, "Objetivo no encontrado");
  }

  return card;
}

export async function getAccessibleItemOrThrow(
  cardId: string,
  itemId: string,
  auth: AuthContext,
) {
  const item = await prisma.objectiveItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      cardId: true,
      card: { select: { assignedToUserId: true } },
    },
  });

  if (!item || item.cardId !== cardId) {
    throw new AppError(404, "Ítem no encontrado");
  }

  if (!auth.isAdmin && item.card?.assignedToUserId !== auth.userId) {
    throw new AppError(404, "Ítem no encontrado");
  }

  return item;
}

