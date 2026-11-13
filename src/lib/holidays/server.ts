import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  buildReservationReminderDates,
  calculateReservationExpiration,
  isReservationDayType,
  type ExpiryKind,
  type HolidayCalendar,
} from "@/lib/signatures/reservation-expiry";
import { SIGNATURE_TERMINAL_STATUSES } from "@/lib/signatures";
import { syncExpiryCalendar } from "@/lib/api/reservation-calendar";
import { fetchColegioHolidays, type ColegioHoliday } from "./colegio";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Feriados bajados del Colegio + el rango que cubren (de la primera a la última
 * sincronización buena). null si nunca se sincronizó: se usan las reglas propias.
 */
export async function loadHolidayCalendar(): Promise<HolidayCalendar | null> {
  const range = await prisma.holidaySync.aggregate({
    where: { ok: true },
    _min: { rangeFrom: true },
    _max: { rangeTo: true },
  });
  const from = range._min.rangeFrom;
  const to = range._max.rangeTo;
  if (!from || !to) return null;
  const rows = await prisma.holiday.findMany({
    where: { day: { gte: from, lte: to } },
    select: { day: true },
    orderBy: { day: "asc" },
  });
  return { from: iso(from), to: iso(to), days: rows.map((r) => iso(r.day)) };
}

export interface HolidayChange {
  day: string;
  description: string;
}

export interface RecalculatedExpiry {
  proposalId: string;
  address: string;
  kind: ExpiryKind;
  before: string;
  after: string;
}

export interface HolidaySyncResult {
  from: string;
  to: string;
  added: HolidayChange[];
  removed: HolidayChange[];
  recalculated: RecalculatedExpiry[];
  calendarFailed: number;
}

/**
 * Baja los feriados del Colegio para [from, to], los deja iguales en la base y,
 * si algo cambió (o es la primera vez), recalcula los vencimientos abiertos.
 * Siempre deja registrada la corrida en jp_holiday_syncs.
 */
export async function syncHolidays(from: string, to: string): Promise<HolidaySyncResult> {
  let colegio: ColegioHoliday[];
  try {
    // `to` puede volver recortado al último día que el Colegio tiene cargado.
    ({ holidays: colegio, to } = await fetchColegioHolidays(from, to));
  } catch (error) {
    await prisma.holidaySync.create({
      data: {
        rangeFrom: toDate(from),
        rangeTo: toDate(to),
        ok: false,
        error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      },
    });
    throw error;
  }

  const firstSync = (await prisma.holidaySync.count({ where: { ok: true } })) === 0;
  const existing = await prisma.holiday.findMany({
    where: { day: { gte: toDate(from), lte: toDate(to) } },
  });
  const existingByDay = new Map(existing.map((h) => [iso(h.day), h]));
  const colegioByDay = new Map(colegio.map((h) => [h.day, h]));

  const added = colegio.filter((h) => !existingByDay.has(h.day));
  const removed = existing
    .filter((h) => !colegioByDay.has(iso(h.day)))
    .map((h) => ({ day: iso(h.day), description: h.description }));
  const renamed = colegio.filter((h) => {
    const prev = existingByDay.get(h.day);
    return prev && prev.description !== h.description;
  });

  await prisma.$transaction([
    ...(removed.length > 0
      ? [prisma.holiday.deleteMany({ where: { day: { in: removed.map((h) => toDate(h.day)) } } })]
      : []),
    ...added.map((h) => prisma.holiday.create({ data: { day: toDate(h.day), description: h.description } })),
    ...renamed.map((h) => prisma.holiday.update({ where: { day: toDate(h.day) }, data: { description: h.description } })),
  ]);

  // Primera vez: todo lo cargado es "nuevo" para la base, pero lo que importa es
  // si cambia algún vencimiento, así que se recalcula igual.
  const changed = firstSync || added.length > 0 || removed.length > 0;
  const { recalculated, calendarFailed } = changed
    ? await recalculateOpenExpiries()
    : { recalculated: [], calendarFailed: 0 };

  await prisma.holidaySync.create({
    data: {
      rangeFrom: toDate(from),
      rangeTo: toDate(to),
      ok: true,
      // En la primera carga no se listan como "nuevos" (sería todo el año).
      added: (firstSync ? [] : added) as unknown as Prisma.InputJsonValue,
      removed: (firstSync ? [] : removed) as unknown as Prisma.InputJsonValue,
      recalculated: recalculated.length,
    },
  });

  return {
    from,
    to,
    added: firstSync ? [] : added,
    removed: firstSync ? [] : removed,
    recalculated,
    calendarFailed,
  };
}

/**
 * Recalcula reserva y refuerzo de las propuestas abiertas con los feriados
 * actuales. Solo toca las que cambian: fecha, avisos, Google Calendar y una
 * línea en la historia de la propuesta.
 */
export async function recalculateOpenExpiries(): Promise<{ recalculated: RecalculatedExpiry[]; calendarFailed: number }> {
  const calendar = await loadHolidayCalendar();
  const proposals = await prisma.signatureProposal.findMany({
    where: {
      status: { notIn: [...SIGNATURE_TERMINAL_STATUSES] },
      reservationDate: { not: null },
    },
    select: {
      id: true,
      createdByUserId: true,
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
    },
  });

  const recalculated: RecalculatedExpiry[] = [];
  let calendarFailed = 0;

  for (const p of proposals) {
    const slots = [
      { kind: "reserva" as const, start: p.reservationDate, term: p.reservationTermDays, type: p.reservationDayType, current: p.reservationExpiresAt },
      ...(p.hasReinforcement
        ? [{ kind: "refuerzo" as const, start: p.reinforcementDate, term: p.reinforcementTermDays, type: p.reinforcementDayType, current: p.reinforcementExpiresAt }]
        : []),
    ];
    const changes: RecalculatedExpiry[] = [];
    for (const s of slots) {
      if (!s.start || !s.term || !isReservationDayType(s.type) || s.type !== "business") continue;
      const next = calculateReservationExpiration(s.start, s.term, s.type, calendar);
      if (s.current && iso(s.current) === iso(next)) continue;
      changes.push({
        proposalId: p.id,
        address: p.property.address,
        kind: s.kind,
        before: s.current ? iso(s.current) : "—",
        after: iso(next),
      });
    }
    if (changes.length === 0) continue;

    await prisma.$transaction(async (tx) => {
      for (const c of changes) {
        const expiresAt = toDate(c.after);
        await tx.signatureProposal.update({
          where: { id: p.id },
          data: c.kind === "reserva" ? { reservationExpiresAt: expiresAt } : { reinforcementExpiresAt: expiresAt },
        });
        await tx.signatureReservationReminder.deleteMany({ where: { proposalId: p.id, kind: c.kind } });
        await tx.signatureReservationReminder.createMany({
          data: buildReservationReminderDates(expiresAt, c.kind).map((r) => ({ ...r, proposalId: p.id })),
        });
        await tx.signatureProposalAction.create({
          data: {
            proposalId: p.id,
            type: "reservation_update",
            description: `Recalculado automáticamente por cambio de feriados (Colegio de Escribanos): ${
              c.kind === "reserva" ? "la reserva" : "el refuerzo"
            } vence el ${c.after.split("-").reverse().join("/")} (antes ${c.before.split("-").reverse().join("/")})`,
            createdByUserId: p.createdByUserId,
          },
        });
      }
    });

    // Mueve los eventos ya agendados (no crea nuevos).
    const { failed } = await syncExpiryCalendar(p.id, p.createdByUserId, {});
    calendarFailed += failed.length;
    recalculated.push(...changes);
  }

  return { recalculated, calendarFailed };
}

export interface HolidayNoticeData {
  ranAt: string;
  added: HolidayChange[];
  removed: HolidayChange[];
  recalculated: number;
}

/** Último chequeo de la semana que cambió algo (para el aviso en Estado de firmas). */
export async function latestHolidayNotice(): Promise<HolidayNoticeData | null> {
  const rows = await prisma.holidaySync.findMany({
    where: { ok: true, ranAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { ranAt: "desc" },
    take: 10,
    select: { ranAt: true, added: true, removed: true, recalculated: true },
  });
  const asList = (v: unknown) => (Array.isArray(v) ? (v as HolidayChange[]) : []);
  const hit = rows.find((r) => r.recalculated > 0 || asList(r.added).length > 0 || asList(r.removed).length > 0);
  return hit
    ? { ranAt: hit.ranAt.toISOString(), added: asList(hit.added), removed: asList(hit.removed), recalculated: hit.recalculated }
    : null;
}
