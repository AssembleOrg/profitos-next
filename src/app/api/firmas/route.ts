import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { describeColleague, parseColleague, signatureInclude } from "@/lib/api/signatures";
import { isSignatureStatus } from "@/lib/signatures";
import {
  calculateReservationExpiration,
  buildReservationReminderDates,
  isReservationDayType,
} from "@/lib/signatures/reservation-expiry";
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
  };

  // Si el inmueble lo tiene en cartera un colega no está publicado: se crea una
  // ficha mínima (sólo dirección, source "colega") fuera del catálogo.
  const quickAddress = typeof newPropertyAddress === "string" ? newPropertyAddress.trim().slice(0, 300) : "";
  if (!propertyId && !quickAddress) throw new AppError(400, "Falta la propiedad");
  const colleague = await parseColleague(body as Record<string, unknown>);
  if (!reservationDate) throw new AppError(400, "La fecha de reserva es obligatoria");
  if (!Number.isInteger(reservationTermDays) || reservationTermDays! <= 0 || reservationTermDays! > 3650) {
    throw new AppError(400, "La vigencia debe ser un número entero entre 1 y 3650");
  }
  if (!isReservationDayType(reservationDayType)) {
    throw new AppError(400, "Seleccioná si la vigencia se expresa en días hábiles o corridos");
  }

  let reservationExpiresAt: Date;
  try {
    reservationExpiresAt = calculateReservationExpiration(
      reservationDate,
      reservationTermDays!,
      reservationDayType,
    );
  } catch (error) {
    throw new AppError(400, error instanceof Error ? error.message : "Datos de reserva inválidos");
  }

  if (propertyId) {
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!property) throw new AppError(404, "Propiedad no encontrada");
  }

  const initialStatus = status && isSignatureStatus(status) ? status : "propuesta_enviada";

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

    return tx.signatureProposal.create({
      data: {
        propertyId: resolvedPropertyId,
        ...colleague,
        title: title?.trim() || null,
        description: description?.trim() || null,
        attachments: (attachments as Prisma.InputJsonValue) ?? undefined,
        status: initialStatus,
        reservationDate: new Date(`${reservationDate.slice(0, 10)}T00:00:00.000Z`),
        reservationTermDays,
        reservationDayType,
        reservationExpiresAt,
        reservationReminders: {
          create: buildReservationReminderDates(reservationExpiresAt),
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
      include: signatureInclude,
    });
  });

  return created(proposal, "Propuesta creada correctamente", path);
});
