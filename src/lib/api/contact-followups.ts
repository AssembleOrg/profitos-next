import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import type { AuthContext } from "@/lib/api/auth";

export async function getAccessibleContactFollowUpOrThrow(
  followUpId: string,
  auth: AuthContext
) {
  const followUp = await prisma.contactFollowUp.findUnique({
    where: { id: followUpId },
  });

  if (!followUp) {
    throw new AppError(404, "Seguimiento de consulta no encontrado");
  }

  if (!auth.isAdmin && followUp.assignedToUserId !== auth.userId) {
    throw new AppError(404, "Seguimiento de consulta no encontrado");
  }

  return followUp;
}

