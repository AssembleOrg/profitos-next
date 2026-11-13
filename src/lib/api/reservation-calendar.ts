import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  createAllDayEvent,
  deleteCalendarEvent,
  getValidGoogleToken,
  updateAllDayEvent,
  type AllDayEventInput,
} from "@/lib/google/calendar";
import {
  formatExpiryLong,
  RESERVATION_DAY_TYPE_LABEL,
  isReservationDayType,
  type ExpiryKind,
} from "@/lib/signatures/reservation-expiry";

// Evento de día completo: los minutos cuentan desde las 00:00 del vencimiento.
// 15 días antes, 5 días antes y el día anterior, siempre a las 9:00.
const REMINDER_MINUTES = [15 * 1440 - 9 * 60, 5 * 1440 - 9 * 60, 1440 - 9 * 60];

/** Qué quiere el usuario por cada vencimiento. `undefined` = dejarlo como está. */
export type CalendarWish = Partial<Record<ExpiryKind, boolean>>;

const proposalSelect = {
  id: true,
  title: true,
  propertyId: true,
  property: { select: { address: true } },
  reservationDate: true,
  reservationTermDays: true,
  reservationDayType: true,
  reservationExpiresAt: true,
  hasReinforcement: true,
  reinforcementDate: true,
  reinforcementTermDays: true,
  reinforcementDayType: true,
  reinforcementExpiresAt: true,
  reservationCalendarEventId: true,
  reservationCalendarUserId: true,
  reinforcementCalendarEventId: true,
  reinforcementCalendarUserId: true,
} satisfies Prisma.SignatureProposalSelect;

type ProposalForCalendar = Prisma.SignatureProposalGetPayload<{ select: typeof proposalSelect }>;

function slot(p: ProposalForCalendar, kind: ExpiryKind) {
  if (kind === "reserva") {
    return {
      start: p.reservationDate,
      termDays: p.reservationTermDays,
      dayType: p.reservationDayType,
      expiresAt: p.reservationExpiresAt,
      eventId: p.reservationCalendarEventId,
      ownerId: p.reservationCalendarUserId,
    };
  }
  return {
    start: p.reinforcementDate,
    termDays: p.reinforcementTermDays,
    dayType: p.reinforcementDayType,
    expiresAt: p.hasReinforcement ? p.reinforcementExpiresAt : null,
    eventId: p.reinforcementCalendarEventId,
    ownerId: p.reinforcementCalendarUserId,
  };
}

function dmy(date: Date): string {
  return date.toISOString().slice(0, 10).split("-").reverse().join("/");
}

function eventInput(p: ProposalForCalendar, kind: ExpiryKind, origin?: string): AllDayEventInput {
  const s = slot(p, kind);
  const what = kind === "reserva" ? "la reserva" : "el refuerzo";
  const address = p.property.address;
  const dayLabel = isReservationDayType(s.dayType) ? RESERVATION_DAY_TYPE_LABEL[s.dayType].toLowerCase() : "días";
  const lines = [
    s.start && s.termDays ? `${kind === "reserva" ? "Reserva" : "Refuerzo"} del ${dmy(s.start)} por ${s.termDays} ${dayLabel}.` : null,
    `Vence el ${formatExpiryLong(s.expiresAt!)}.`,
    p.title ? `Propuesta: ${p.title}` : null,
    origin ? `${origin}/firmas?propertyId=${encodeURIComponent(p.propertyId)}` : "Profitos · Estado de firmas",
  ].filter(Boolean);
  return {
    title: `Vence ${what} — ${address}`,
    description: lines.join("\n"),
    date: s.expiresAt!.toISOString().slice(0, 10),
    location: address,
    reminderMinutes: REMINDER_MINUTES,
  };
}

async function removeEvent(ownerId: string | null, eventId: string) {
  if (!ownerId) return;
  const token = await getValidGoogleToken(ownerId);
  if (!token) return;
  // Si ya no existe en Google, da igual: lo soltamos de este lado.
  await deleteCalendarEvent(token, eventId);
}

/**
 * Deja el Google Calendar alineado con la propuesta: crea, mueve o borra el
 * evento de vencimiento de la reserva y del refuerzo según lo tildado.
 * Nunca tira error: devuelve qué vencimientos no se pudieron agendar.
 */
export async function syncExpiryCalendar(
  proposalId: string,
  actingUserId: string,
  wish: CalendarWish,
  origin?: string,
): Promise<{ failed: ExpiryKind[] }> {
  const proposal = await prisma.signatureProposal.findUnique({ where: { id: proposalId }, select: proposalSelect });
  if (!proposal) return { failed: [] };

  const failed: ExpiryKind[] = [];
  const data: Record<string, string | null> = {};
  const fields = {
    reserva: { eventId: "reservationCalendarEventId", userId: "reservationCalendarUserId" },
    refuerzo: { eventId: "reinforcementCalendarEventId", userId: "reinforcementCalendarUserId" },
  } as const;

  for (const kind of ["reserva", "refuerzo"] as const) {
    const s = slot(proposal, kind);
    const want = s.expiresAt ? (wish[kind] ?? s.eventId !== null) : false;

    try {
      if (!want) {
        if (s.eventId) {
          await removeEvent(s.ownerId, s.eventId);
          data[fields[kind].eventId] = null;
          data[fields[kind].userId] = null;
        }
        continue;
      }

      const input = eventInput(proposal, kind, origin);
      if (s.eventId) {
        const owner = s.ownerId ?? actingUserId;
        const token = await getValidGoogleToken(owner);
        if (!token) {
          failed.push(kind);
          continue;
        }
        const { error, notFound } = await updateAllDayEvent(token, s.eventId, input);
        if (!error) continue;
        if (!notFound) {
          failed.push(kind);
          continue;
        }
        // Lo borraron definitivamente en Google: se crea de nuevo abajo.
      }

      const token = await getValidGoogleToken(actingUserId);
      if (!token) {
        failed.push(kind);
        if (s.eventId) {
          data[fields[kind].eventId] = null;
          data[fields[kind].userId] = null;
        }
        continue;
      }
      const { eventId } = await createAllDayEvent(token, input);
      if (!eventId) {
        failed.push(kind);
        continue;
      }
      data[fields[kind].eventId] = eventId;
      data[fields[kind].userId] = actingUserId;
    } catch (error) {
      console.error(`[Firmas] No se pudo sincronizar el vencimiento (${kind}) con Google Calendar:`, error);
      failed.push(kind);
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.signatureProposal.update({ where: { id: proposalId }, data });
  }
  return { failed };
}

/** Borra de Google los vencimientos agendados (al eliminar la propuesta). */
export async function removeExpiryEvents(proposal: {
  reservationCalendarEventId: string | null;
  reservationCalendarUserId: string | null;
  reinforcementCalendarEventId: string | null;
  reinforcementCalendarUserId: string | null;
}) {
  const jobs: Promise<void>[] = [];
  if (proposal.reservationCalendarEventId) {
    jobs.push(removeEvent(proposal.reservationCalendarUserId, proposal.reservationCalendarEventId));
  }
  if (proposal.reinforcementCalendarEventId) {
    jobs.push(removeEvent(proposal.reinforcementCalendarUserId, proposal.reinforcementCalendarEventId));
  }
  await Promise.allSettled(jobs);
}
