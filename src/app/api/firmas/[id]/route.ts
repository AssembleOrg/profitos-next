import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import {
  assertCanDeleteProposal,
  getProposalOrThrow,
  signatureInclude,
  syncDateVisit,
} from "@/lib/api/signatures";
import {
  SIGNATURE_DATE_META,
  isSignatureStatus,
  type SignatureDateField,
} from "@/lib/signatures";
import type { Prisma } from "@/generated/prisma/client";
import {
  calculateReservationExpiration,
  buildReservationReminderDates,
  isReservationDayType,
} from "@/lib/signatures/reservation-expiry";

const DATE_FIELDS: SignatureDateField[] = ["dateProcessStarted", "dateAgreed", "dateKeysHandover"];

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const proposal = await getProposalOrThrow(id);
  return ok(proposal, "Propuesta obtenida correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const proposal = await getProposalOrThrow(id);
  const body = (await request.json()) as Record<string, unknown>;

  const data: Prisma.SignatureProposalUpdateInput = {};
  const auditActions: Array<{
    type: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    dateField?: string | null;
    description?: string;
  }> = [];

  // Title / description / attachments — patch directly
  if (typeof body.title === "string" || body.title === null) {
    const value = typeof body.title === "string" ? body.title.trim() || null : null;
    data.title = value;
  }
  if (typeof body.description === "string" || body.description === null) {
    const value = typeof body.description === "string" ? body.description.trim() || null : null;
    data.description = value;
  }
  if (body.attachments !== undefined) {
    data.attachments = (body.attachments as Prisma.InputJsonValue) ?? null;
  }

  // La vigencia se actualiza como una unidad y el vencimiento siempre se
  // recalcula en backend (nunca se acepta una fecha derivada del cliente).
  const reservationKeys = ["reservationDate", "reservationTermDays", "reservationDayType"];
  if (reservationKeys.some((key) => key in body)) {
    const rawDate = "reservationDate" in body ? body.reservationDate : proposal.reservationDate;
    const rawTerm = "reservationTermDays" in body ? body.reservationTermDays : proposal.reservationTermDays;
    const rawType = "reservationDayType" in body ? body.reservationDayType : proposal.reservationDayType;

    if (!(typeof rawDate === "string" || rawDate instanceof Date)) {
      throw new AppError(400, "La fecha de reserva es obligatoria");
    }
    if (!Number.isInteger(rawTerm) || (rawTerm as number) <= 0 || (rawTerm as number) > 3650) {
      throw new AppError(400, "La vigencia debe ser un número entero entre 1 y 3650");
    }
    if (!isReservationDayType(rawType)) {
      throw new AppError(400, "Tipo de días inválido");
    }

    let expiresAt: Date;
    try {
      expiresAt = calculateReservationExpiration(rawDate, rawTerm as number, rawType);
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : "Datos de reserva inválidos");
    }

    const parsedDate = rawDate instanceof Date
      ? rawDate
      : new Date(`${rawDate.slice(0, 10)}T00:00:00.000Z`);
    data.reservationDate = parsedDate;
    data.reservationTermDays = rawTerm as number;
    data.reservationDayType = rawType;
    data.reservationExpiresAt = expiresAt;
    data.reservationReminders = {
      deleteMany: {},
      create: buildReservationReminderDates(expiresAt),
    };
    auditActions.push({
      type: "reservation_update",
      description: `Reserva vigente hasta ${expiresAt.toISOString().slice(0, 10)} (${rawTerm} ${rawType === "business" ? "días hábiles" : "días corridos"})`,
    });
  }

  // Status change
  if (typeof body.status === "string" && body.status !== proposal.status) {
    if (!isSignatureStatus(body.status)) throw new AppError(400, "Estado inválido");
    data.status = body.status;
    auditActions.push({
      type: "status_change",
      fromStatus: proposal.status,
      toStatus: body.status,
      description: typeof body.statusNote === "string" ? body.statusNote.trim() : undefined,
    });
  }

  // Date fields with visit sync
  for (const field of DATE_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    let nextDate: Date | null = null;
    if (raw !== null && raw !== "") {
      if (typeof raw !== "string") throw new AppError(400, `Fecha inválida en ${field}`);
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) throw new AppError(400, `Fecha inválida en ${field}`);
      nextDate = dt;
    }
    const prevDate = proposal[field];
    const prevTime = prevDate ? prevDate.getTime() : null;
    const nextTime = nextDate ? nextDate.getTime() : null;
    if (prevTime === nextTime) continue;

    const meta = SIGNATURE_DATE_META[field];
    const visitId = await syncDateVisit({
      proposalId: proposal.id,
      field,
      newDate: nextDate,
      currentVisitId: proposal[meta.visitIdProperty] ?? null,
      propertyId: proposal.propertyId,
      propertyAddress: proposal.property.address,
      fallbackUserId: auth.userId,
    });

    data[field] = nextDate;
    data[meta.visitIdProperty] = visitId;

    auditActions.push({
      type: "date_set",
      dateField: field,
      description: nextDate
        ? `${meta.label}: ${nextDate.toISOString().slice(0, 10)}`
        : `${meta.label}: limpiado`,
    });
  }

  if (Object.keys(data).length === 0 && auditActions.length === 0) {
    return ok(proposal, "Sin cambios", path);
  }

  const updated = await prisma.signatureProposal.update({
    where: { id },
    data: {
      ...data,
      ...(auditActions.length > 0 && {
        actions: {
          create: auditActions.map((action) => ({
            type: action.type,
            fromStatus: action.fromStatus ?? null,
            toStatus: action.toStatus ?? null,
            dateField: action.dateField ?? null,
            description: action.description ?? null,
            createdByUserId: auth.userId,
          })),
        },
      }),
    },
    include: signatureInclude,
  });

  return ok(updated, "Propuesta actualizada correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const proposal = await getProposalOrThrow(id);
  assertCanDeleteProposal(proposal, auth);

  // Limpiar Visits asociados
  const visitIds = [
    proposal.visitInformesId,
    proposal.visitAcordadaId,
    proposal.visitEntregaId,
  ].filter(Boolean) as string[];
  if (visitIds.length > 0) {
    await prisma.visit.deleteMany({ where: { id: { in: visitIds } } });
  }

  await prisma.signatureProposal.delete({ where: { id } });
  return ok(null, "Propuesta eliminada correctamente", path);
});
