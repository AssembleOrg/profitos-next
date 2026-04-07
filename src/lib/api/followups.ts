import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import type { AuthContext } from "@/lib/api/auth";

export async function getAccessibleFollowUpOrThrow(
  followUpId: string,
  auth: AuthContext
) {
  const followUp = await prisma.propertyFollowUp.findUnique({
    where: { id: followUpId },
  });

  if (!followUp) {
    throw new AppError(404, "Seguimiento no encontrado");
  }

  if (!auth.isAdmin && followUp.assignedToUserId !== auth.userId) {
    throw new AppError(404, "Seguimiento no encontrado");
  }

  return followUp;
}

export function assertAdmin(auth: AuthContext) {
  if (!auth.isAdmin) {
    throw new AppError(403, "Solo un administrador puede realizar esta acción");
  }
}
