import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/api/auth";
import { SIGNATURE_DATE_META, type SignatureDateField } from "@/lib/signatures";

export const signatureInclude = {
  property: {
    select: {
      id: true,
      address: true,
      city: true,
      zone: true,
      type: true,
      status: true,
      operationType: true,
      coverImageUrl: true,
      photos: true,
    },
  },
  createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
  actions: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.SignatureProposalInclude;

export async function getProposalOrThrow(id: string) {
  const proposal = await prisma.signatureProposal.findUnique({
    where: { id },
    include: signatureInclude,
  });
  if (!proposal) throw new AppError(404, "Propuesta no encontrada");
  return proposal;
}

export function assertCanDeleteProposal(
  proposal: { createdByUserId: string },
  auth: AuthContext,
) {
  if (auth.isAdmin) return;
  if (proposal.createdByUserId === auth.userId) return;
  throw new AppError(403, "Solo el admin o quien creó la propuesta puede eliminarla");
}

export function assertCanDeleteAction(
  action: { createdByUserId: string },
  auth: AuthContext,
) {
  if (auth.isAdmin) return;
  if (action.createdByUserId === auth.userId) return;
  throw new AppError(403, "Solo el admin o el autor puede eliminar esta acción");
}

interface SyncVisitArgs {
  proposalId: string;
  field: SignatureDateField;
  newDate: Date | null;
  currentVisitId: string | null;
  propertyId: string;
  propertyAddress: string;
  fallbackUserId: string;
}

/**
 * Creates / updates / deletes the Visit associated with one of the proposal dates,
 * keeping the agenda in sync. Returns the resulting visitId (or null if cleared).
 */
export async function syncDateVisit(args: SyncVisitArgs): Promise<string | null> {
  const { newDate, currentVisitId, propertyId, propertyAddress, fallbackUserId, field } = args;
  const meta = SIGNATURE_DATE_META[field];

  // Resolve owning user: agente of the property if available, else creator
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { userId: true },
  });
  const visitUserId = property?.userId ?? fallbackUserId;

  if (newDate === null) {
    if (currentVisitId) {
      await prisma.visit.deleteMany({ where: { id: currentVisitId } });
    }
    return null;
  }

  const title = `${meta.label} — ${propertyAddress}`;
  const dateOnly = new Date(newDate);
  dateOnly.setHours(0, 0, 0, 0);

  if (currentVisitId) {
    const existing = await prisma.visit.findUnique({ where: { id: currentVisitId } });
    if (existing) {
      await prisma.visit.update({
        where: { id: currentVisitId },
        data: {
          title,
          date: dateOnly,
          type: meta.visitType,
        },
      });
      return existing.id;
    }
  }

  const created = await prisma.visit.create({
    data: {
      title,
      date: dateOnly,
      startTime: "09:00",
      endTime: "10:00",
      type: meta.visitType,
      propertyId,
      userId: visitUserId,
    },
  });
  return created.id;
}
