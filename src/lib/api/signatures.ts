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
      source: true,
    },
  },
  colleagueAgency: { select: { id: true, name: true } },
  accountEntries: { select: { status: true } },
  createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
  actions: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.SignatureProposalInclude;

export interface ColleagueData {
  withColleague: boolean;
  colleagueAgencyId: string | null;
  colleagueName: string | null;
  colleagueSharePercent: number | null;
}

/**
 * Valida los datos de "operación con colega". Sin colega se limpian los demás
 * campos. Con colega: inmobiliaria o nombre (al menos uno) y % compartido 0–100.
 */
export async function parseColleague(body: Record<string, unknown>): Promise<ColleagueData> {
  if (body.withColleague !== true) {
    return { withColleague: false, colleagueAgencyId: null, colleagueName: null, colleagueSharePercent: null };
  }
  const agencyId = typeof body.colleagueAgencyId === "string" && body.colleagueAgencyId ? body.colleagueAgencyId : null;
  const name = typeof body.colleagueName === "string" ? body.colleagueName.trim().slice(0, 200) || null : null;
  if (!agencyId && !name) throw new AppError(400, "Indicá la inmobiliaria o el nombre del colega");
  if (agencyId) {
    const exists = await prisma.agency.count({ where: { id: agencyId } });
    if (!exists) throw new AppError(400, "La inmobiliaria del colega no existe");
  }
  const share = body.colleagueSharePercent;
  if (typeof share !== "number" || !Number.isFinite(share) || share < 0 || share > 100) {
    throw new AppError(400, "Indicá el % de honorarios que se comparte con el colega (0 a 100)");
  }
  return { withColleague: true, colleagueAgencyId: agencyId, colleagueName: name, colleagueSharePercent: share };
}

export interface OperationData {
  operationAmount: number | null;
  operationCurrency: "ARS" | "USD";
  feePercentage: number | null;
}

/** Valor de la operación + % de honorarios (ambos opcionales hasta que se conozcan). */
export function parseOperation(body: Record<string, unknown>): OperationData {
  const amount = body.operationAmount;
  const fee = body.feePercentage;
  const currency = body.operationCurrency ?? "USD";
  if (currency !== "ARS" && currency !== "USD") throw new AppError(400, "Moneda inválida (ARS/USD)");
  if (amount != null && (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)) {
    throw new AppError(400, "El valor de la operación debe ser mayor a cero");
  }
  if (fee != null && (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0 || fee > 100)) {
    throw new AppError(400, "Los honorarios deben ser un % entre 0 y 100");
  }
  return {
    operationAmount: (amount as number | null | undefined) ?? null,
    operationCurrency: currency,
    feePercentage: (fee as number | null | undefined) ?? null,
  };
}

/** Texto para la línea de tiempo cuando cambia el colega. */
export function describeColleague(data: ColleagueData, agencyName: string | null): string {
  if (!data.withColleague) return "Operación 100% propia (sin colega)";
  const who = [data.colleagueName, agencyName].filter(Boolean).join(" · ");
  return `Con colega: ${who} — se comparte el ${data.colleagueSharePercent}% de los honorarios`;
}

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
