import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { CalendarEvent } from "./_components/calendar";
import { AgendaClient } from "./_components/agenda-client";

export default async function AgendaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const visitas = await prisma.visit.findMany({
    where: { userId: user.id },
    include: { client: true, property: true },
    orderBy: { date: "asc" },
  });

  const events: CalendarEvent[] = visitas.map((v) => ({
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
  }));

  return <AgendaClient events={events} />;
}
