import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

function subtractDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const daysRaw = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "7", 10);
  const days = [1, 7, 30].includes(daysRaw) ? daysRaw : 7;
  const sinceDate = subtractDays(days);

  const contactWhere = auth.isAdmin
    ? {}
    : { agentEmail: { equals: auth.email, mode: "insensitive" as const } };
  const propertyFollowUpWhere = auth.isAdmin ? {} : { assignedToUserId: auth.userId };
  const contactFollowUpWhere = auth.isAdmin ? {} : { assignedToUserId: auth.userId };

  const [
    propertiesActive,
    propertiesNewPeriod,
    contactsNewPeriod,
    pendingPropertyFollowUps,
    overduePropertyFollowUps,
    pendingContactFollowUps,
    statusBreakdownRaw,
    lastPropertiesRaw,
    lastContactsRaw,
    propertyFollowUpsRaw,
    contactFollowUpsRaw,
    propertyActionsRaw,
    contactActionsRaw,
  ] = await Promise.all([
    prisma.property.count({
      where: { status: "activa" },
    }),
    prisma.property.count({
      where: { createdAt: { gte: sinceDate } },
    }),
    prisma.recentContact.count({
      where: {
        ...contactWhere,
        createdAt: { gte: sinceDate },
      },
    }),
    prisma.propertyFollowUp.count({
      where: {
        ...propertyFollowUpWhere,
        status: { notIn: ["hecho", "cancelado"] },
      },
    }),
    prisma.propertyFollowUp.count({
      where: {
        ...propertyFollowUpWhere,
        status: { notIn: ["hecho", "cancelado"] },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.contactFollowUp.count({
      where: {
        ...contactFollowUpWhere,
        status: { in: ["pendiente", "iniciada", "activa"] },
      },
    }),
    prisma.contactFollowUp.groupBy({
      by: ["status"],
      where: contactFollowUpWhere,
      _count: { _all: true },
    }),
    prisma.property.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        address: true,
        city: true,
        type: true,
        status: true,
        operationType: true,
        operationPrice: true,
        operationCurrency: true,
        createdAt: true,
      },
    }),
    prisma.recentContact.findMany({
      where: contactWhere,
      orderBy: [{ externalCreatedAt: "desc" }, { externalId: "desc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        cellphone: true,
        phone: true,
        leadStatus: true,
        agentName: true,
        externalCreatedAt: true,
      },
    }),
    prisma.propertyFollowUp.findMany({
      where: propertyFollowUpWhere,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        property: { select: { address: true } },
        assignedToUser: { select: { fullName: true, email: true } },
      },
    }),
    prisma.contactFollowUp.findMany({
      where: contactFollowUpWhere,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        recentContact: { select: { name: true } },
        assignedToUser: { select: { fullName: true, email: true } },
      },
    }),
    prisma.followUpAction.findMany({
      where: auth.isAdmin
        ? {}
        : {
            followUp: {
              assignedToUserId: auth.userId,
            },
          },
      orderBy: [{ actionAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        type: true,
        description: true,
        actionAt: true,
        followUp: {
          select: {
            property: { select: { address: true } },
          },
        },
        createdByUser: { select: { fullName: true, email: true } },
      },
    }),
    prisma.contactFollowUpAction.findMany({
      where: auth.isAdmin
        ? {}
        : {
            followUp: {
              assignedToUserId: auth.userId,
            },
          },
      orderBy: [{ actionAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        type: true,
        description: true,
        actionAt: true,
        followUp: {
          select: {
            recentContact: { select: { name: true } },
          },
        },
        createdByUser: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  const statusBreakdown = {
    pendiente: 0,
    iniciada: 0,
    activa: 0,
    cerrada: 0,
  };

  for (const row of statusBreakdownRaw) {
    if (row.status in statusBreakdown) {
      statusBreakdown[row.status as keyof typeof statusBreakdown] = row._count._all;
    }
  }

  const recentFollowUps = [
    ...propertyFollowUpsRaw.map((item) => ({
      kind: "propiedad" as const,
      id: item.id,
      title: item.property.address,
      status: item.status,
      responsible: item.assignedToUser.fullName?.trim() || item.assignedToUser.email,
      updatedAt: item.updatedAt.toISOString(),
    })),
    ...contactFollowUpsRaw.map((item) => ({
      kind: "consulta" as const,
      id: item.id,
      title: item.recentContact.name,
      status: item.status,
      responsible: item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin asignar",
      updatedAt: item.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const recentActions = [
    ...propertyActionsRaw.map((item) => ({
      kind: "propiedad" as const,
      id: item.id,
      type: item.type,
      description: item.description,
      title: item.followUp.property.address,
      author: item.createdByUser.fullName?.trim() || item.createdByUser.email,
      actionAt: item.actionAt.toISOString(),
    })),
    ...contactActionsRaw.map((item) => ({
      kind: "consulta" as const,
      id: item.id,
      type: item.type,
      description: item.description,
      title: item.followUp.recentContact.name,
      author: item.createdByUser?.fullName?.trim() || item.createdByUser?.email || "Sistema",
      actionAt: item.actionAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.actionAt).getTime() - new Date(a.actionAt).getTime())
    .slice(0, 5);

  const payload = {
    scope: auth.isAdmin ? "admin" : "user",
    generatedAt: new Date().toISOString(),
    days,
    kpis: {
      propertiesActive,
      propertiesNewPeriod,
      contactsNewPeriod,
      pendingPropertyFollowUps,
      pendingContactFollowUps,
      overduePropertyFollowUps,
    },
    statusBreakdown,
    lastProperties: lastPropertiesRaw.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    lastContacts: lastContactsRaw.map((item) => ({
      ...item,
      externalCreatedAt: item.externalCreatedAt?.toISOString() ?? null,
    })),
    recentFollowUps,
    recentActions,
  };

  return ok(payload, "Resumen de dashboard obtenido", path);
});
