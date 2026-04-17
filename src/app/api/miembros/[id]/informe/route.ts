import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) throw new AppError(403, "Solo administradores");

  const { id } = await context!.params;

  // Get whitelist entry → find user by email
  const whitelist = await prisma.whitelist.findUnique({ where: { id } });
  if (!whitelist) throw new AppError(404, "Miembro no encontrado");

  const user = await prisma.user.findFirst({
    where: { email: { equals: whitelist.email, mode: "insensitive" } },
    select: { id: true, email: true, fullName: true, avatarUrl: true, role: true },
  });

  if (!user) throw new AppError(400, "Este miembro no tiene cuenta aún");

  // Parse date range
  const sp = request.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(sp.get("from")!) : startOfMonth();
  const to = sp.get("to") ? new Date(sp.get("to")!) : endOfToday();
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const dateRange = { gte: from, lte: to };
  const userId = user.id;

  const [
    // KPIs
    segPropAsignados,
    segPropCompletados,
    segPropVencidos,
    segContactosAsignados,
    visitasRealizadas,
    clientesCreados,
    accionesSeg,
    accionesContacto,
    cambiosEstado,

    // Breakdown
    segPropPorEstadoRaw,
    segContactosPorEstadoRaw,
    accionesPorTipoRaw,
    accionesContactoPorTipoRaw,

    // Detail lists
    seguimientosProp,
    seguimientosContacto,
    visitas,
    clientes,

    // Timeline items
    followUpActions,
    contactFollowUpActions,
    statusChanges,
  ] = await Promise.all([
    // KPIs
    prisma.propertyFollowUp.count({
      where: { assignedToUserId: userId, createdAt: dateRange },
    }),
    prisma.propertyFollowUp.count({
      where: { assignedToUserId: userId, status: "hecho", updatedAt: dateRange },
    }),
    prisma.propertyFollowUp.count({
      where: {
        assignedToUserId: userId,
        status: { notIn: ["hecho", "cancelado"] },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.contactFollowUp.count({
      where: { assignedToUserId: userId, createdAt: dateRange },
    }),
    prisma.visit.count({
      where: { userId, date: dateRange },
    }),
    prisma.client.count({
      where: { userId, createdAt: dateRange },
    }),
    prisma.followUpAction.count({
      where: { createdByUserId: userId, createdAt: dateRange },
    }),
    prisma.contactFollowUpAction.count({
      where: { createdByUserId: userId, createdAt: dateRange },
    }),
    prisma.contactFollowUpStatusChange.count({
      where: { changedByUserId: userId, createdAt: dateRange },
    }),

    // Breakdowns
    prisma.propertyFollowUp.groupBy({
      by: ["status"],
      where: { assignedToUserId: userId, createdAt: dateRange },
      _count: { _all: true },
    }),
    prisma.contactFollowUp.groupBy({
      by: ["status"],
      where: { assignedToUserId: userId, createdAt: dateRange },
      _count: { _all: true },
    }),
    prisma.followUpAction.groupBy({
      by: ["type"],
      where: { createdByUserId: userId, createdAt: dateRange },
      _count: { _all: true },
    }),
    prisma.contactFollowUpAction.groupBy({
      by: ["type"],
      where: { createdByUserId: userId, createdAt: dateRange },
      _count: { _all: true },
    }),

    // Detail: property follow-ups
    prisma.propertyFollowUp.findMany({
      where: { assignedToUserId: userId, createdAt: dateRange },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        createdAt: true,
        property: { select: { id: true, address: true } },
        _count: { select: { actions: true } },
      },
    }),

    // Detail: contact follow-ups
    prisma.contactFollowUp.findMany({
      where: { assignedToUserId: userId, createdAt: dateRange },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        recentContact: {
          select: { id: true, name: true, email: true, cellphone: true, phone: true },
        },
        _count: { select: { actions: true } },
        statusChanges: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { fromStatus: true, toStatus: true, createdAt: true },
        },
      },
    }),

    // Detail: visits
    prisma.visit.findMany({
      where: { userId, date: dateRange },
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        date: true,
        startTime: true,
        endTime: true,
        type: true,
        property: { select: { id: true, address: true } },
        client: { select: { id: true, name: true } },
      },
    }),

    // Detail: clients
    prisma.client.findMany({
      where: { userId, createdAt: dateRange },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: { select: { visitas: true } },
      },
    }),

    // Timeline: follow-up actions
    prisma.followUpAction.findMany({
      where: { createdByUserId: userId, createdAt: dateRange },
      orderBy: { actionAt: "desc" },
      select: {
        id: true,
        type: true,
        description: true,
        actionAt: true,
        followUp: {
          select: { property: { select: { address: true } } },
        },
      },
    }),

    // Timeline: contact follow-up actions
    prisma.contactFollowUpAction.findMany({
      where: { createdByUserId: userId, createdAt: dateRange },
      orderBy: { actionAt: "desc" },
      select: {
        id: true,
        type: true,
        description: true,
        actionAt: true,
        followUp: {
          select: { recentContact: { select: { name: true } } },
        },
      },
    }),

    // Timeline: status changes
    prisma.contactFollowUpStatusChange.findMany({
      where: { changedByUserId: userId, createdAt: dateRange },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        createdAt: true,
        followUp: {
          select: { recentContact: { select: { name: true } } },
        },
      },
    }),
  ]);

  // Build timeline
  const timeline = [
    ...followUpActions.map((a) => ({
      kind: "accion_seguimiento" as const,
      date: a.actionAt.toISOString(),
      type: a.type,
      description: a.description,
      entity: a.followUp.property.address,
    })),
    ...contactFollowUpActions.map((a) => ({
      kind: "accion_contacto" as const,
      date: a.actionAt.toISOString(),
      type: a.type,
      description: a.description,
      entity: a.followUp.recentContact.name,
    })),
    ...statusChanges.map((s) => ({
      kind: "cambio_estado" as const,
      date: s.createdAt.toISOString(),
      type: "estado",
      description: `${s.fromStatus} → ${s.toStatus}${s.note ? ` (${s.note})` : ""}`,
      entity: s.followUp.recentContact.name,
    })),
    ...visitas.map((v) => ({
      kind: "visita" as const,
      date: v.date.toISOString(),
      type: v.type,
      description: v.title,
      entity: v.property?.address ?? "Sin propiedad",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Build breakdowns
  const segPropPorEstado: Record<string, number> = {};
  for (const r of segPropPorEstadoRaw) segPropPorEstado[r.status] = r._count._all;

  const segContactosPorEstado: Record<string, number> = {};
  for (const r of segContactosPorEstadoRaw) segContactosPorEstado[r.status] = r._count._all;

  const allActionTypes: Record<string, number> = {};
  for (const r of accionesPorTipoRaw) allActionTypes[r.type] = (allActionTypes[r.type] ?? 0) + r._count._all;
  for (const r of accionesContactoPorTipoRaw) allActionTypes[r.type] = (allActionTypes[r.type] ?? 0) + r._count._all;

  // Resumen ejecutivo
  const totalAcciones = accionesSeg + accionesContacto;
  const diasEnRango = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
  const tasaResolucion = segPropAsignados > 0 ? Math.round((segPropCompletados / segPropAsignados) * 100) : null;
  const actividadPorDia = Math.round((totalAcciones / diasEnRango) * 10) / 10;

  let estadoGeneral: "alto" | "moderado" | "bajo";
  if (actividadPorDia >= 3) estadoGeneral = "alto";
  else if (actividadPorDia >= 1) estadoGeneral = "moderado";
  else estadoGeneral = "bajo";

  const payload = {
    member: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    },
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    resumen: {
      tasaResolucion,
      actividadPorDia,
      totalAcciones,
      contactosGestionados: seguimientosContacto.length,
      segVencidos: segPropVencidos,
      estadoGeneral,
    },
    kpis: {
      segPropAsignados,
      segPropCompletados,
      segContactosAsignados,
      visitasRealizadas,
      clientesCreados,
      totalAcciones,
      cambiosEstado,
    },
    breakdowns: {
      segPropPorEstado,
      segContactosPorEstado,
      accionesPorTipo: allActionTypes,
    },
    seguimientosProp: seguimientosProp.map((s) => ({
      ...s,
      dueDate: s.dueDate?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    seguimientosContacto: seguimientosContacto.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      statusChanges: s.statusChanges.map((sc) => ({
        ...sc,
        createdAt: sc.createdAt.toISOString(),
      })),
    })),
    visitas: visitas.map((v) => ({
      ...v,
      date: v.date.toISOString(),
    })),
    clientes: clientes.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    timeline,
  };

  return ok(payload, "Informe obtenido", path);
});
