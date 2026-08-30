import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";

export const GET = withHandler(async (request) => {
  const auth = await getAuthContext();
  const searchParams = request.nextUrl.searchParams;
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "15", 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 15;

  const followUpWhere = auth.isAdmin ? {} : { assignedToUserId: auth.userId };

  const [followUps, properties, overdueFollowUps, closedPublications] = await Promise.all([
    prisma.propertyFollowUp.findMany({
      where: followUpWhere,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        property: { select: { id: true, address: true } },
        assignedToUser: { select: { id: true, fullName: true, email: true } },
        assignedByUser: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.property.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        address: true,
        publicationTitle: true,
        status: true,
        operationType: true,
        operationPrice: true,
        operationCurrency: true,
        createdAt: true,
        producerName: true,
        branchName: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.propertyFollowUp.findMany({
      where: {
        ...followUpWhere,
        dueDate: { lt: new Date() },
        status: { notIn: ["hecho", "cancelado"] },
      },
      orderBy: [{ dueDate: "asc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        updatedAt: true,
        createdAt: true,
        property: { select: { id: true, address: true } },
        assignedToUser: { select: { id: true, fullName: true, email: true } },
        assignedByUser: { select: { id: true, fullName: true, email: true } },
      },
    }),
    // Publicaciones que pasaron a pausada/cerrada (ej: ML pausó un aviso). El
    // sync del worker actualiza el estado → updatedAt marca el evento.
    prisma.propertyPublication.findMany({
      where: { status: { in: ["paused", "closed"] } },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        portal: true,
        status: true,
        permalink: true,
        updatedAt: true,
        property: { select: { id: true, address: true } },
      },
    }),
  ]);

  const merged = [
    ...followUps.map((item) => ({
      kind: "followup_assignment" as const,
      eventAt: item.updatedAt,
      payload: {
        id: item.id,
        title: item.title,
        status: item.status,
        updatedAt: item.updatedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        property: item.property,
        assignedToUser: item.assignedToUser,
        assignedByUser: item.assignedByUser,
      },
    })),
    ...properties.map((item) => ({
      kind: "property" as const,
      eventAt: item.createdAt,
      payload: {
        id: item.id,
        address: item.address,
        publicationTitle: item.publicationTitle,
        status: item.status,
        operationType: item.operationType,
        operationPrice: item.operationPrice,
        operationCurrency: item.operationCurrency,
        createdAt: item.createdAt.toISOString(),
        createdByUser: item.user,
        producerName: item.producerName,
        branchName: item.branchName,
      },
    })),
    ...overdueFollowUps.map((item) => ({
      kind: "overdue_followup" as const,
      eventAt: item.dueDate ?? item.updatedAt,
      payload: {
        id: item.id,
        title: item.title,
        status: item.status,
        dueDate: item.dueDate?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        property: item.property,
        assignedToUser: item.assignedToUser,
        assignedByUser: item.assignedByUser,
      },
    })),
    ...closedPublications.map((item) => ({
      kind: "publication_closed" as const,
      eventAt: item.updatedAt,
      payload: {
        id: item.id,
        portal: item.portal,
        status: item.status,
        permalink: item.permalink,
        property: item.property,
      },
    })),
  ]
    .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())
    .slice(0, limit)
    .map((item) => ({
      kind: item.kind,
      eventAt: item.eventAt.toISOString(),
      ...item.payload,
    }));

  return ok(
    {
      items: merged,
    },
    "Notificaciones obtenidas",
    request.nextUrl.pathname
  );
});
