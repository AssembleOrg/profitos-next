import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { createCalendarEvent, getValidGoogleToken } from "@/lib/google/calendar";

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError(401, "No autenticado");
  return user.id;
}

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);

  const where = { userId };

  const [visitas, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      skip: paginationToSkip(page, limit),
      take: limit,
      orderBy: { date: "asc" },
    }),
    prisma.visit.count({ where }),
  ]);

  const result = buildPaginatedResult(visitas, total, page, limit);
  return paginated(result, "Visitas obtenidas correctamente", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const body = await request.json();

  const { title, description, date, startTime, endTime, type, propertyId, clientId } = body as {
    title?: string;
    description?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    type?: string;
    propertyId?: string;
    clientId?: string;
  };

  if (!title) throw new AppError(400, "El campo 'title' es obligatorio");
  if (!date) throw new AppError(400, "El campo 'date' es obligatorio");
  if (!startTime) throw new AppError(400, "El campo 'startTime' es obligatorio");
  if (!endTime) throw new AppError(400, "El campo 'endTime' es obligatorio");

  // Resolve property address for Google Calendar location
  let propertyAddress: string | undefined;
  if (propertyId) {
    const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { address: true } });
    propertyAddress = prop?.address ?? undefined;
  }

  // Try to create Google Calendar event (with auto token refresh)
  let googleEventId: string | null = null;
  const accessToken = await getValidGoogleToken(userId);

  if (accessToken) {
    const { eventId } = await createCalendarEvent(accessToken, {
      title,
      description,
      date,
      startTime,
      endTime,
      location: propertyAddress,
    });
    googleEventId = eventId;
  }

  const visit = await prisma.visit.create({
    data: {
      title,
      description: description ?? null,
      date: new Date(date),
      startTime,
      endTime,
      type: type ?? "visita",
      propertyId: propertyId ?? null,
      clientId: clientId ?? null,
      googleEventId,
      userId,
    },
  });

  return created(visit, "Visita creada correctamente", path);
});
