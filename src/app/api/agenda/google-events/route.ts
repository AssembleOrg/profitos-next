import type { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getValidGoogleToken, listCalendarEvents, type GoogleCalendarListEvent } from "@/lib/google/calendar";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "America/Argentina/Buenos_Aires";

/** Forma que consume el componente de calendario (overlay solo lectura). */
export interface GoogleAgendaEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  allDay: boolean;
  source: "google";
  htmlLink?: string;
}

/**
 * Respuesta del overlay. `connected: false` permite a la UI distinguir
 * "el usuario no conectó Google" de "conectó pero no tiene reuniones".
 */
export interface GoogleAgendaPayload {
  connected: boolean;
  events: GoogleAgendaEvent[];
}

function mapEvent(e: GoogleCalendarListEvent): GoogleAgendaEvent | null {
  const title = e.summary?.trim() || "(sin título)";

  // Evento de día completo: usa `date` (YYYY-MM-DD).
  if (e.start?.date) {
    return {
      id: `g_${e.id}`,
      title,
      date: e.start.date,
      startTime: "00:00",
      endTime: "23:59",
      allDay: true,
      source: "google",
      htmlLink: e.htmlLink,
    };
  }

  if (!e.start?.dateTime) return null;
  const start = DateTime.fromISO(e.start.dateTime, { setZone: true }).setZone(TZ);
  const end = e.end?.dateTime ? DateTime.fromISO(e.end.dateTime, { setZone: true }).setZone(TZ) : start;
  const date = start.toISODate();
  if (!date) return null;

  return {
    id: `g_${e.id}`,
    title,
    date,
    startTime: start.toFormat("HH:mm"),
    endTime: end.toFormat("HH:mm"),
    allDay: false,
    source: "google",
    htmlLink: e.htmlLink,
  };
}

/**
 * Lista las reuniones del Google Calendar del usuario logueado (solo lectura)
 * para mostrarlas como overlay en la agenda. Si el usuario no tiene token de
 * Google, devuelve una lista vacía (degradación elegante).
 */
export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const sp = request.nextUrl.searchParams;

  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !DATE_RE.test(from) || !to || !DATE_RE.test(to)) {
    return ok<GoogleAgendaPayload>({ connected: true, events: [] }, "Rango inválido", path);
  }

  const token = await getValidGoogleToken(auth.userId);
  if (!token) {
    return ok<GoogleAgendaPayload>(
      { connected: false, events: [] },
      "Usuario sin Google Calendar conectado",
      path
    );
  }

  const { events } = await listCalendarEvents(token, from, to);
  const mapped = events.map(mapEvent).filter((e): e is GoogleAgendaEvent => e !== null);

  return ok<GoogleAgendaPayload>(
    { connected: true, events: mapped },
    "Eventos de Google Calendar obtenidos",
    path
  );
});
