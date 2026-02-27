import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { updateCalendarEvent, deleteCalendarEvent, getValidGoogleToken } from "@/lib/google/calendar";

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError(401, "No autenticado");
  return user.id;
}

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const { id } = await context!.params;

  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit || visit.userId !== userId) throw new AppError(404, "Visita no encontrada");

  return ok(visit, "Visita obtenida correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const { id } = await context!.params;

  const existing = await prisma.visit.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new AppError(404, "Visita no encontrada");

  const body = await request.json();
  const { title, description, date, startTime, endTime, type, propertyId, clientId } = body as Record<string, string | undefined>;

  const visit = await prisma.visit.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(type !== undefined && { type }),
      ...(propertyId !== undefined && { propertyId }),
      ...(clientId !== undefined && { clientId }),
    },
  });

  // Sync to Google Calendar if linked
  if (visit.googleEventId) {
    let location: string | undefined;
    if (visit.propertyId) {
      const prop = await prisma.property.findUnique({ where: { id: visit.propertyId }, select: { address: true } });
      location = prop?.address ?? undefined;
    }

    const accessToken = await getValidGoogleToken(userId);
    if (accessToken) {
      await updateCalendarEvent(accessToken, visit.googleEventId, {
        title: visit.title,
        description: visit.description ?? undefined,
        date: visit.date.toISOString().split("T")[0],
        startTime: visit.startTime,
        endTime: visit.endTime,
        location,
      });
    }
  }

  return ok(visit, "Visita actualizada correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const { id } = await context!.params;

  const visit = await prisma.visit.findUnique({ where: { id } });
  if (!visit || visit.userId !== userId) throw new AppError(404, "Visita no encontrada");

  // Delete from Google Calendar if linked
  if (visit.googleEventId) {
    const accessToken = await getValidGoogleToken(userId);
    if (accessToken) {
      await deleteCalendarEvent(accessToken, visit.googleEventId);
    }
  }

  await prisma.visit.delete({ where: { id } });

  return ok(null, "Visita eliminada correctamente", path);
});
