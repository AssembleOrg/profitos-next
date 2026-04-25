import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SIGNATURE_VISIT_TYPES } from "@/lib/signatures";
import type { CalendarEvent } from "./_components/calendar";
import { AgendaClient } from "./_components/agenda-client";

export default async function AgendaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Visits de firma son globales (el equipo entero los ve).
  // El resto sigue la regla de admin / usuario propio.
  const where =
    user.role === "admin"
      ? {}
      : {
          OR: [
            { userId: user.id },
            { type: { in: [...SIGNATURE_VISIT_TYPES] } },
          ],
        };

  const visitas = await prisma.visit.findMany({
    where,
    include: { client: true, property: true, user: { select: { fullName: true, email: true } } },
    orderBy: { date: "asc" },
  });

  const events: CalendarEvent[] = visitas.map((v: {
    id: string;
    title: string;
    date: Date;
    startTime: string;
    endTime: string;
    type: string;
    description: string | null;
    client: { name: string } | null;
    clientId: string | null;
    property: { address: string } | null;
    propertyId: string | null;
    user: { fullName: string | null; email: string } | null;
  }) => ({
    id: v.id,
    title: v.title,
    date: v.date.toISOString().split("T")[0],
    startTime: v.startTime,
    endTime: v.endTime,
    type: v.type as CalendarEvent["type"],
    description: v.description ?? undefined,
    client: v.client?.name ?? undefined,
    clientId: v.clientId ?? undefined,
    property: v.property?.address ?? undefined,
    propertyId: v.propertyId ?? undefined,
    userName: v.user?.fullName?.trim() || v.user?.email || undefined,
  }));

  return <AgendaClient events={events} />;
}
