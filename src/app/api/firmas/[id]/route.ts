import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import {
  assertCanDeleteProposal,
  describeColleague,
  getProposalOrThrow,
  parseColleague,
  parseOperation,
  signatureInclude,
  syncDateVisit,
} from "@/lib/api/signatures";
import {
  SIGNATURE_DATE_META,
  isSignatureStatus,
  type SignatureDateField,
} from "@/lib/signatures";
import type { Prisma } from "@/generated/prisma/client";
import { syncSignatureReceivable } from "@/lib/api/signature-receivable";
import { formatMoney } from "@/lib/account";
import {
  calculateReservationExpiration,
  buildReservationReminderDates,
  isReservationDayType,
  resolveTerm,
  RESERVATION_DAY_TYPE_LABEL,
  type ExpiryKind,
} from "@/lib/signatures/reservation-expiry";
import { removeExpiryEvents, syncExpiryCalendar, type CalendarWish } from "@/lib/api/reservation-calendar";
import { resolvePublicOrigin } from "@/lib/server/public-origin";

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

  // Avisos (15 días, 5 días, el día): se reemplazan por tipo de vencimiento.
  const reminderKinds: ExpiryKind[] = [];
  const reminderCreates: ReturnType<typeof buildReservationReminderDates> = [];

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
    reminderKinds.push("reserva");
    reminderCreates.push(...buildReservationReminderDates(expiresAt, "reserva"));
    auditActions.push({
      type: "reservation_update",
      description: `Reserva vigente hasta ${expiresAt.toISOString().slice(0, 10)} (${rawTerm} ${rawType === "business" ? "días hábiles" : "días corridos"})`,
    });
  }

  // Refuerzo: también como una unidad. Sin refuerzo = se limpian sus datos y avisos.
  const reinforcementKeys = ["hasReinforcement", "reinforcementDate", "reinforcementTermDays", "reinforcementDayType"];
  const reinforcementTouched = reinforcementKeys.some((key) => key in body);
  if (reinforcementTouched) {
    const wantsReinforcement = "hasReinforcement" in body ? body.hasReinforcement === true : proposal.hasReinforcement;
    if (!wantsReinforcement) {
      if (proposal.hasReinforcement) {
        data.hasReinforcement = false;
        data.reinforcementDate = null;
        data.reinforcementTermDays = null;
        data.reinforcementDayType = null;
        data.reinforcementExpiresAt = null;
        reminderKinds.push("refuerzo");
        auditActions.push({ type: "reservation_update", description: "Sin refuerzo" });
      }
    } else {
      let term;
      try {
        term = resolveTerm(
          {
            date: "reinforcementDate" in body ? body.reinforcementDate : proposal.reinforcementDate,
            termDays: "reinforcementTermDays" in body ? body.reinforcementTermDays : proposal.reinforcementTermDays,
            dayType: "reinforcementDayType" in body ? body.reinforcementDayType : proposal.reinforcementDayType,
          },
          "el refuerzo",
        );
      } catch (error) {
        throw new AppError(400, error instanceof Error ? error.message : "Datos del refuerzo inválidos");
      }
      const same =
        proposal.hasReinforcement &&
        proposal.reinforcementDate?.getTime() === term.date.getTime() &&
        proposal.reinforcementTermDays === term.termDays &&
        proposal.reinforcementDayType === term.dayType;
      if (!same) {
        data.hasReinforcement = true;
        data.reinforcementDate = term.date;
        data.reinforcementTermDays = term.termDays;
        data.reinforcementDayType = term.dayType;
        data.reinforcementExpiresAt = term.expiresAt;
        reminderKinds.push("refuerzo");
        reminderCreates.push(...buildReservationReminderDates(term.expiresAt, "refuerzo"));
        auditActions.push({
          type: "reservation_update",
          description: `Refuerzo vigente hasta ${term.expiresAt.toISOString().slice(0, 10)} (${term.termDays} ${RESERVATION_DAY_TYPE_LABEL[term.dayType].toLowerCase()})`,
        });
      }
    }
  }

  if (reminderKinds.length > 0) {
    data.reservationReminders = {
      deleteMany: { kind: { in: reminderKinds } },
      ...(reminderCreates.length > 0 && { create: reminderCreates }),
    };
  }

  // Tildes de Google Calendar (true = agendar, false = sacar del calendario).
  const calendarWish: CalendarWish = {};
  if (typeof body.reservationCalendar === "boolean") calendarWish.reserva = body.reservationCalendar;
  if (typeof body.reinforcementCalendar === "boolean") calendarWish.refuerzo = body.reinforcementCalendar;
  const calendarTouched =
    reminderKinds.length > 0 || calendarWish.reserva !== undefined || calendarWish.refuerzo !== undefined;

  // Operación con colega: se actualiza como una unidad.
  if ("withColleague" in body) {
    const colleague = await parseColleague(body);
    const changed =
      colleague.withColleague !== proposal.withColleague ||
      colleague.colleagueAgencyId !== proposal.colleagueAgencyId ||
      colleague.colleagueName !== proposal.colleagueName ||
      colleague.colleagueSharePercent !== proposal.colleagueSharePercent ||
      colleague.collectsAll !== proposal.collectsAll;
    if (changed) {
      data.withColleague = colleague.withColleague;
      data.colleagueAgency = colleague.colleagueAgencyId
        ? { connect: { id: colleague.colleagueAgencyId } }
        : { disconnect: true };
      data.colleagueName = colleague.colleagueName;
      data.colleagueSharePercent = colleague.colleagueSharePercent;
      data.collectsAll = colleague.collectsAll;
      const agencyName = colleague.colleagueAgencyId
        ? (await prisma.agency.findUnique({ where: { id: colleague.colleagueAgencyId }, select: { name: true } }))?.name ?? null
        : null;
      auditActions.push({ type: "colleague_update", description: describeColleague(colleague, agencyName) });
    }
  }

  // Valor de la operación y honorarios: se actualizan como una unidad.
  if (["operationAmount", "operationCurrency", "feePercentage", "feeAmount"].some((k) => k in body)) {
    const op = parseOperation({
      operationAmount: "operationAmount" in body ? body.operationAmount : proposal.operationAmount,
      operationCurrency: "operationCurrency" in body ? body.operationCurrency : proposal.operationCurrency,
      feePercentage: "feePercentage" in body ? body.feePercentage : proposal.feePercentage,
      feeAmount: "feeAmount" in body ? body.feeAmount : proposal.feeAmount,
    });
    if (
      op.operationAmount !== proposal.operationAmount ||
      op.operationCurrency !== proposal.operationCurrency ||
      op.feePercentage !== proposal.feePercentage ||
      op.feeAmount !== proposal.feeAmount
    ) {
      Object.assign(data, op);
      const feeText =
        op.feeAmount != null
          ? ` · honorarios fijos ${formatMoney(op.feeAmount, op.operationCurrency)}`
          : op.feePercentage != null
            ? ` · honorarios ${op.feePercentage}%`
            : "";
      auditActions.push({
        type: "operation_update",
        description:
          op.operationAmount != null
            ? `Operación: ${formatMoney(op.operationAmount, op.operationCurrency)}${feeText}`
            : op.feeAmount != null
              ? `Honorarios fijos ${formatMoney(op.feeAmount, op.operationCurrency)}`
              : "Operación sin valor cargado",
      });
    }
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
    if (!calendarTouched) return ok(proposal, "Sin cambios", path);
    // Solo se tildó/destildó el calendario.
    const { failed } = await syncExpiryCalendar(proposal.id, auth.userId, calendarWish, resolvePublicOrigin(request.headers));
    const fresh = await getProposalOrThrow(proposal.id);
    return ok({ ...fresh, calendarFailed: failed }, "Propuesta actualizada correctamente", path);
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
    select: { id: true },
  });

  // Recalcula (o borra si se rechazó) los honorarios "a cobrar".
  await syncSignatureReceivable(updated.id);

  // Mueve/crea/borra los vencimientos en Google Calendar si cambió algo de eso.
  let calendarFailed: ExpiryKind[] = [];
  if (calendarTouched) {
    ({ failed: calendarFailed } = await syncExpiryCalendar(
      updated.id,
      auth.userId,
      calendarWish,
      resolvePublicOrigin(request.headers),
    ));
  }
  const fresh = await getProposalOrThrow(updated.id);

  return ok({ ...fresh, calendarFailed }, "Propuesta actualizada correctamente", path);
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

  // Vencimientos agendados en Google Calendar.
  await removeExpiryEvents(proposal);

  // Los honorarios pendientes se van con la firma; los ya cobrados quedan.
  await prisma.accountEntry.deleteMany({ where: { signatureProposalId: id, status: "pending" } });
  await prisma.signatureProposal.delete({ where: { id } });
  return ok(null, "Propuesta eliminada correctamente", path);
});
