import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";

export const GET = withHandler(async (request) => {
  const auth = await getAuthContext();
  const searchParams = request.nextUrl.searchParams;
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "15", 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 15;

  const contactWhere = auth.isAdmin
    ? {}
    : { agentEmail: { equals: auth.email, mode: "insensitive" as const } };

  const followUpWhere = auth.isAdmin ? {} : { assignedToUserId: auth.userId };

  const [contacts, followUps, properties] = await Promise.all([
    prisma.recentContact.findMany({
      where: contactWhere,
      orderBy: [{ tokkoCreatedAt: "desc" }, { tokkoContactId: "desc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        cellphone: true,
        phone: true,
        leadStatus: true,
        agentName: true,
        agentEmail: true,
        tokkoCreatedAt: true,
        createdAt: true,
        tokkoContactId: true,
      },
    }),
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
      },
    }),
  ]);

  const merged = [
    ...contacts.map((item) => ({
      kind: "contact" as const,
      eventAt: item.tokkoCreatedAt ?? item.createdAt,
      payload: {
        ...item,
        tokkoCreatedAt: item.tokkoCreatedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      },
    })),
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
