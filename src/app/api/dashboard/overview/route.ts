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
  const sinceDate = subtractDays(7);

  const propertyFollowUpWhere = auth.isAdmin ? {} : { assignedToUserId: auth.userId };

  const [
    propertiesActive,
    propertiesNewPeriod,
    pendingPropertyFollowUps,
    overduePropertyFollowUps,
    unansweredQuestions,
    questionsAgg,
    lastPropertiesRaw,
    propertyFollowUpsRaw,
    propertyActionsRaw,
  ] = await Promise.all([
    prisma.property.count({
      where: { status: "activa" },
    }),
    prisma.property.count({
      where: { status: "activa", createdAt: { gte: sinceDate } },
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
    prisma.portalQuestion.count({
      where: { portal: "mercadolibre", status: "UNANSWERED" },
    }),
    // Última sync: el upsert (webhook o "Traer de ML") bumpea updatedAt.
    prisma.portalQuestion.aggregate({
      where: { portal: "mercadolibre" },
      _max: { updatedAt: true },
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
  ]);

  const recentFollowUps = propertyFollowUpsRaw
    .map((item) => ({
      kind: "propiedad" as const,
      id: item.id,
      title: item.property.address,
      status: item.status,
      responsible: item.assignedToUser.fullName?.trim() || item.assignedToUser.email,
      updatedAt: item.updatedAt.toISOString(),
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const recentActions = propertyActionsRaw
    .map((item) => ({
      kind: "propiedad" as const,
      id: item.id,
      type: item.type,
      description: item.description,
      title: item.followUp.property.address,
      author: item.createdByUser.fullName?.trim() || item.createdByUser.email,
      actionAt: item.actionAt.toISOString(),
    }))
    .sort((a, b) => new Date(b.actionAt).getTime() - new Date(a.actionAt).getTime())
    .slice(0, 5);

  const payload = {
    scope: auth.isAdmin ? "admin" : "user",
    generatedAt: new Date().toISOString(),
    kpis: {
      propertiesActive,
      propertiesNewPeriod,
      pendingPropertyFollowUps,
      overduePropertyFollowUps,
      unansweredQuestions,
      questionsSyncedAt: questionsAgg._max.updatedAt?.toISOString() ?? null,
    },
    lastProperties: lastPropertiesRaw.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    recentFollowUps,
    recentActions,
  };

  return ok(payload, "Resumen de dashboard obtenido", path);
});
