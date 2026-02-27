import { prisma } from "@/lib/prisma/client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface CalendarEventInput {
  title: string;
  description?: string;
  date: string; // ISO date "2026-02-26"
  startTime: string; // "14:00"
  endTime: string; // "15:00"
  location?: string;
}

interface GoogleCalendarEvent {
  id: string;
  htmlLink: string;
  summary: string;
}

/* ------------------------------------------------------------------ */
/*  Token refresh                                                      */
/* ------------------------------------------------------------------ */

async function refreshAccessToken(
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("[Google Calendar] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — cannot refresh token");
    return null;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Google Calendar] Token refresh failed ${res.status}: ${body}`);
      return null;
    }

    const data = await res.json();
    return data.access_token ?? null;
  } catch (err) {
    console.error("[Google Calendar] Token refresh error:", err);
    return null;
  }
}

/**
 * Get a valid Google access token for a user, refreshing if needed.
 * Updates the DB with the new token on refresh.
 */
export async function getValidGoogleToken(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true },
  });

  if (!user?.googleAccessToken) return null;

  // Quick validation: lightweight API call
  const testRes = await fetch(
    `${CALENDAR_API}/calendars/primary?fields=id`,
    { headers: { Authorization: `Bearer ${user.googleAccessToken}` } }
  );

  if (testRes.ok) return user.googleAccessToken;

  // Token expired — try refresh
  if (!user.googleRefreshToken) {
    console.warn("[Google Calendar] No refresh token for user", userId);
    return null;
  }

  const newToken = await refreshAccessToken(user.googleRefreshToken);
  if (!newToken) return null;

  // Persist new token
  await prisma.user.update({
    where: { id: userId },
    data: { googleAccessToken: newToken },
  });

  return newToken;
}

/* ------------------------------------------------------------------ */
/*  Calendar API helpers                                               */
/* ------------------------------------------------------------------ */

async function calendarFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Google Calendar] ${res.status}: ${body}`);
    return { data: null, error: `Google Calendar API error: ${res.status}` };
  }

  if (res.status === 204) return { data: null, error: null };

  const data = (await res.json()) as T;
  return { data, error: null };
}

/** Normalize "HH:mm" or "HH:mm:ss" → "HH:mm:ss" */
function normalizeTime(t: string): string {
  const parts = t.split(":");
  return `${parts[0]}:${parts[1]}:${parts[2] ?? "00"}`;
}

function buildEventBody(input: CalendarEventInput) {
  const timeZone = "America/Argentina/Buenos_Aires";
  const start = normalizeTime(input.startTime);
  const end = normalizeTime(input.endTime);

  // If start >= end, push end 1 hour forward to avoid "timeRangeEmpty"
  let endDateTime = `${input.date}T${end}`;
  if (start >= end) {
    const [h, m] = input.startTime.split(":").map(Number);
    const endH = String(Math.min(h + 1, 23)).padStart(2, "0");
    endDateTime = `${input.date}T${endH}:${String(m).padStart(2, "0")}:00`;
  }

  return {
    summary: input.title,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: { dateTime: `${input.date}T${start}`, timeZone },
    end: { dateTime: endDateTime, timeZone },
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function createCalendarEvent(
  accessToken: string,
  input: CalendarEventInput
): Promise<{ eventId: string | null; error: string | null }> {
  const { data, error } = await calendarFetch<GoogleCalendarEvent>(
    accessToken,
    "/calendars/primary/events",
    { method: "POST", body: JSON.stringify(buildEventBody(input)) }
  );

  if (error || !data) return { eventId: null, error };
  return { eventId: data.id, error: null };
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  input: CalendarEventInput
): Promise<{ error: string | null }> {
  const { error } = await calendarFetch<GoogleCalendarEvent>(
    accessToken,
    `/calendars/primary/events/${eventId}`,
    { method: "PATCH", body: JSON.stringify(buildEventBody(input)) }
  );
  return { error };
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<{ error: string | null }> {
  const { error } = await calendarFetch<never>(
    accessToken,
    `/calendars/primary/events/${eventId}`,
    { method: "DELETE" }
  );
  return { error };
}
