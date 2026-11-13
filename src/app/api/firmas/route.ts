import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { describeColleague, parseColleague, parseOperation, parsePartyClientId, signatureInclude } from "@/lib/api/signatures";
import { parseEnvelopeAmount, toCustodyCurrency } from "@/lib/signatures/custody";
import { syncSignatureReceivable } from "@/lib/api/signature-receivable";
import { isSignatureStatus } from "@/lib/signatures";
import {
  calculateReservationExpiration,
  buildReservationReminderDates,
  isReservationDayType,
  resolveTerm,
  parseDoneDate,
  BEFORE_REINFORCEMENT_STATUSES,
  type ResolvedTerm,
} from "@/lib/signatures/reservation-expiry";
import { syncExpiryCalendar } from "@/lib/api/reservation-calendar";
import { resolvePublicOrigin } from "@/lib/server/public-origin";
import { loadHolidayCalendar } from "@/lib/holidays/server";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const sp = request.nextUrl.searchParams;
  const propertyId = sp.get("propertyId")?.trim();
  const status = sp.get("status")?.trim();
  const q = sp.get("q")?.trim();
  const createdByUserId = sp.get("createdByUserId")?.trim();

  const where: Prisma.SignatureProposalWhereInput = {};

  if (propertyId) where.propertyId = propertyId;
  if (status && isSignatureStatus(status)) where.status = status;
  if (createdByUserId) where.createdByUserId = createdByUserId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.signatureProposal.findMany({
      where,
      include: signatureInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: paginationToSkip(page, limit),
      take: limit,
    }),
    prisma.signatureProposal.count({ where }),
  ]);

  const result = buildPaginatedResult(items, total, page, limit);
  return paginated(result, "Firmas obtenidas correctamente", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();

  const body = await request.json();
  const {
    propertyId,
    newPropertyAddress,
    title,
    description,
    attachments,
    status,
    reservationDate,
    reservationTermDays,
    reservationDayType,
    hasReinforcement,
    reinforcementDate,
    reinforcementTermDays,
    reinforcementDayType,
    reservationCalendar,
    reinforcementCalendar,
  } = body as {
    propertyId?: string;
    /** Inmueble en cartera de un colega (no publicado): solo la dirección. */
    newPropertyAddress?: string;
    title?: string;
    description?: string;
    attachments?: unknown[];
    status?: string;
    reservationDate?: string;
    reservationTermDays?: number;
    reservationDayType?: string;
    /** Con refuerzo: además de la reserva, el refuerzo con su propia vigencia. */
    hasReinforcement?: boolean;
    reinforcementDate?: string;
    reinforcementTermDays?: number;
    reinforcementDayType?: string;
    /** Agendar el vencimiento en el Google Calendar de quien carga. */
    reservationCalendar?: boolean;
    reinforcementCalendar?: boolean;
  };

  // Si el inmueble lo tiene en cartera un colega no está publicado: se crea una
  // ficha mínima (sólo dirección, source "colega") fuera del catálogo.
  const quickAddress = typeof newPropertyAddress === "string" ? newPropertyAddress.trim().slice(0, 300) : "";
  if (!propertyId && !quickAddress) throw new AppError(400, "Falta la propiedad");
  const colleague = await parseColleague(body as Record<string, unknown>);
  const operation = parseOperation(body as Record<string, unknown>);
  if (!reservationDate) throw new AppError(400, "La fecha de reserva es obligatoria");
  if (!Number.isInteger(reservationTermDays) || reservationTermDays! <= 0 || reservationTermDays! > 3650) {
    throw new AppError(400, "La vigencia debe ser un número entero entre 1 y 3650");
  }
  if (!isReservationDayType(reservationDayType)) {
    throw new AppError(400, "Seleccioná si la vigencia se expresa en días hábiles o corridos");
  }

  const holidays = await loadHolidayCalendar();
  let reservationExpiresAt: Date;
  try {
    reservationExpiresAt = calculateReservationExpiration(
      reservationDate,
      reservationTermDays!,
      reservationDayType,
      holidays,
    );
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : "Datos de reserva inválidos");
  }

  let reservationAmount: number | null;
  let reinforcementAmount: number | null;
  try {
    reservationAmount = parseEnvelopeAmount((body as Record<string, unknown>).reservationAmount, "de la reserva");
    reinforcementAmount = hasReinforcement === true
      ? parseEnvelopeAmount((body as Record<string, unknown>).reinforcementAmount, "del refuerzo")
      : null;
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : "Monto inválido");
  }
  const buyerClientId = await parsePartyClientId((body as Record<string, unknown>).buyerClientId, "Comprador");
  const sellerClientId = await parsePartyClientId((body as Record<string, unknown>).sellerClientId, "Vendedor");

  // Refuerzo: el plazo corre desde la misma fecha que la reserva (la aceptación).
  // `reinforcementDate` es la fecha en que se hizo (opcional).
  let reinforcement: ResolvedTerm | null = null;
  let reinforcementDoneAt: Date | null = null;
  if (hasReinforcement === true) {
    try {
      reinforcement = resolveTerm(
        { date: reservationDate, termDays: reinforcementTermDays, dayType: reinforcementDayType },
        "el refuerzo",
        holidays,
      );
      reinforcementDoneAt = parseDoneDate(reinforcementDate);
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : "Datos del refuerzo inválidos");
    }
  }

  if (propertyId) {
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!property) throw new AppError(404, "Propiedad no encontrada");
  }

  const requestedStatus = status && isSignatureStatus(status) ? status : "propuesta_enviada";
  // Si ya se cargó que el refuerzo se hizo, arranca en "Refuerzo realizado".
  const initialStatus =
    reinforcementDoneAt && (BEFORE_REINFORCEMENT_STATUSES as readonly string[]).includes(requestedStatus)
      ? "refuerzo_realizado"
      : requestedStatus;

  const colleagueAgencyName = colleague.colleagueAgencyId
    ? (await prisma.agency.findUnique({ where: { id: colleague.colleagueAgencyId }, select: { name: true } }))?.name ?? null
    : null;

  const creationNote = [
    title?.trim() || "Propuesta creada",
    colleague.withColleague ? describeColleague(colleague, colleagueAgencyName) : null,
  ].filter(Boolean).join(" · ");

  const proposal = await prisma.$transaction(async (tx) => {
    const resolvedPropertyId =
      propertyId ||
      (
        await tx.property.create({
          data: { address: quickAddress, source: "colega", status: "activa", operationType: "Venta" },
          select: { id: true },
        })
      ).id;

    const createdProposal = await tx.signatureProposal.create({
      data: {
        propertyId: resolvedPropertyId,
        ...colleague,
        ...operation,
        title: title?.trim() || null,
        description: description?.trim() || null,
        attachments: (attachments as Prisma.InputJsonValue) ?? undefined,
        status: initialStatus,
        reservationDate: new Date(`${reservationDate.slice(0, 10)}T00:00:00.000Z`),
        reservationTermDays,
        reservationDayType,
        reservationExpiresAt,
        reservationAmount,
        reservationCurrency: toCustodyCurrency((body as Record<string, unknown>).reservationCurrency),
        reinforcementAmount,
        reinforcementCurrency: toCustodyCurrency((body as Record<string, unknown>).reinforcementCurrency),
        buyerClientId: buyerClientId ?? null,
        sellerClientId: sellerClientId ?? null,
        hasReinforcement: reinforcement !== null,
        reinforcementDate: reinforcementDoneAt,
        reinforcementTermDays: reinforcement?.termDays ?? null,
        reinforcementDayType: reinforcement?.dayType ?? null,
        reinforcementExpiresAt: reinforcement?.expiresAt ?? null,
        reservationReminders: {
          create: [
            ...buildReservationReminderDates(reservationExpiresAt, "reserva"),
            // Avisos del plazo del refuerzo solo mientras no se hizo.
            ...(reinforcement && !reinforcementDoneAt ? buildReservationReminderDates(reinforcement.expiresAt, "refuerzo") : []),
          ],
        },
        createdByUserId: auth.userId,
        actions: {
          create: {
            type: "creation",
            toStatus: initialStatus,
            description: creationNote,
            attachments: (attachments as Prisma.InputJsonValue) ?? undefined,
            createdByUserId: auth.userId,
          },
        },
      },
      select: { id: true },
    });
    // Honorarios "a cobrar" en estados de cuenta (si ya hay valor y %).
    await syncSignatureReceivable(createdProposal.id, tx);
    return createdProposal;
  });

  // Fuera de la transacción: Google puede tardar y no debe frenar el alta.
  let calendarFailed: string[] = [];
  const wantsReinforcementEvent = !!reinforcement && !reinforcementDoneAt && reinforcementCalendar === true;
  if (reservationCalendar === true || wantsReinforcementEvent) {
    const { failed } = await syncExpiryCalendar(
      proposal.id,
      auth.userId,
      { reserva: reservationCalendar === true, refuerzo: wantsReinforcementEvent },
      resolvePublicOrigin(request.headers),
    );
    calendarFailed = failed;
  }

  const fresh = await prisma.signatureProposal.findUniqueOrThrow({ where: { id: proposal.id }, include: signatureInclude });
  return created({ ...fresh, calendarFailed }, "Propuesta creada correctamente", path);
});
