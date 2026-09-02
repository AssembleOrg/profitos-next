import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";

/**
 * Reporte de desempeño de un empleado en un rango de fechas: objetivos (con
 * el estado de cada item), visitas, seguimientos, contactos tomados, clientes
 * y KPIs derivados. Lo consumen el PDF (/api/reportes/empleado/pdf) y la tool
 * del chat IA (resumen hablado + link al PDF).
 */

export type ObjetivoEstado = "cumplido" | "parcial" | "fallido" | "en_curso" | "vencido";

export type EmployeeReport = {
  member: { id: string; fullName: string | null; email: string; role: string };
  range: { from: Date; to: Date; dias: number };
  kpis: {
    objetivos: { total: number; cumplidos: number; parciales: number; fallidos: number; enCurso: number; vencidos: number };
    items: { total: number; hechos: number; fallidos: number; pendientes: number; cumplimiento: number | null };
    seguimientos: { asignados: number; completados: number; vencidos: number; tasaResolucion: number | null };
    visitas: number;
    acciones: number;
    contactosTomados: number;
    clientesCreados: number;
    propiedadesACargo: number;
    tasaciones: number;
    actividadPorDia: number;
  };
  objetivos: {
    id: string;
    titulo: string;
    descripcion: string | null;
    desde: Date;
    hasta: Date;
    estado: ObjetivoEstado;
    items: { texto: string; estado: string }[];
  }[];
  visitas: { fecha: Date; hora: string; tipo: string; titulo: string; propiedad: string | null; cliente: string | null }[];
  seguimientos: { propiedad: string; titulo: string | null; estado: string; vence: Date | null; acciones: number }[];
  accionesPorTipo: Record<string, number>;
  contactos: { fecha: Date; portal: string; nombre: string | null; propiedad: string | null }[];
  clientes: { nombre: string; fecha: Date }[];
};

export function parseRange(fromRaw?: string | null, toRaw?: string | null): { from: Date; to: Date } {
  const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = toRaw ? new Date(`${toRaw}T23:59:59.999`) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new AppError(400, "Fechas inválidas (usar YYYY-MM-DD)");
  if (from > to) throw new AppError(400, "La fecha de inicio no puede ser posterior a la de fin");
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function objetivoEstado(c: { endDate: Date; statusOverride: string | null; items: { status: string }[] }): ObjetivoEstado {
  if (c.statusOverride === "cumplido" || c.statusOverride === "fallido" || c.statusOverride === "parcial") return c.statusOverride;
  const total = c.items.length;
  const done = c.items.filter((i) => i.status === "done").length;
  const failed = c.items.filter((i) => i.status === "failed").length;
  if (total > 0 && done === total) return "cumplido";
  if (total > 0 && done + failed === total) return done > 0 ? "parcial" : "fallido";
  return c.endDate < new Date() ? "vencido" : "en_curso";
}

export async function buildEmployeeReport(userId: string, from: Date, to: Date): Promise<EmployeeReport> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, email: true, role: true } });
  if (!user) throw new AppError(404, "Usuario no encontrado");
  const range = { gte: from, lte: to };

  const [cards, visitas, seguimientos, segVencidos, accionesRaw, contactos, clientes, propiedadesACargo, tasaciones] = await Promise.all([
    prisma.objectiveCard.findMany({
      where: { assignedToUserId: userId, startDate: { lte: to }, endDate: { gte: from } },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        statusOverride: true,
        items: { select: { text: true, status: true }, orderBy: { position: "asc" } },
      },
      orderBy: [{ startDate: "desc" }],
    }),
    prisma.visit.findMany({
      where: { userId, date: range },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        type: true,
        title: true,
        property: { select: { address: true } },
        client: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
    prisma.propertyFollowUp.findMany({
      where: { assignedToUserId: userId, createdAt: range },
      select: {
        title: true,
        status: true,
        dueDate: true,
        property: { select: { address: true } },
        _count: { select: { actions: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.propertyFollowUp.count({
      where: { assignedToUserId: userId, status: { notIn: ["hecho", "cancelado"] }, dueDate: { lt: new Date() } },
    }),
    prisma.followUpAction.groupBy({
      by: ["type"],
      where: { createdByUserId: userId, actionAt: range },
      _count: { _all: true },
    }),
    prisma.contactCase.findMany({
      where: { takenByUserId: userId, status: "tomado", updatedAt: range },
      select: { id: true, portal: true, updatedAt: true, clientId: true, followUpId: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.client.findMany({ where: { userId, createdAt: range }, select: { name: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.propertyResponsible.count({ where: { userId } }),
    prisma.tasacion.count({ where: { userId, createdAt: range } }),
  ]);

  // ContactCase guarda clientId/followUpId sin relación: resolvemos aparte.
  const clientIds = [...new Set(contactos.map((c) => c.clientId).filter((x): x is string => Boolean(x)))];
  const fuIds = [...new Set(contactos.map((c) => c.followUpId).filter((x): x is string => Boolean(x)))];
  const [caseClients, caseFollowUps] = await Promise.all([
    clientIds.length ? prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [],
    fuIds.length
      ? prisma.propertyFollowUp.findMany({ where: { id: { in: fuIds } }, select: { id: true, property: { select: { address: true } } } })
      : [],
  ]);
  const clientName = new Map(caseClients.map((c) => [c.id, c.name]));
  const fuAddress = new Map(caseFollowUps.map((f) => [f.id, f.property.address]));

  const objetivos = cards.map((c) => ({
    id: c.id,
    titulo: c.title,
    descripcion: c.description,
    desde: c.startDate,
    hasta: c.endDate,
    estado: objetivoEstado(c),
    items: c.items.map((i) => ({ texto: i.text, estado: i.status })),
  }));
  const allItems = cards.flatMap((c) => c.items);
  const hechos = allItems.filter((i) => i.status === "done").length;
  const fallidos = allItems.filter((i) => i.status === "failed").length;
  const count = (e: ObjetivoEstado) => objetivos.filter((o) => o.estado === e).length;

  const accionesPorTipo: Record<string, number> = {};
  let acciones = 0;
  for (const r of accionesRaw) {
    accionesPorTipo[r.type] = r._count._all;
    acciones += r._count._all;
  }
  const segCompletados = seguimientos.filter((s) => s.status === "hecho").length;
  const dias = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  const actividad = acciones + visitas.length + contactos.length;

  return {
    member: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    range: { from, to, dias },
    kpis: {
      objetivos: {
        total: objetivos.length,
        cumplidos: count("cumplido"),
        parciales: count("parcial"),
        fallidos: count("fallido"),
        enCurso: count("en_curso"),
        vencidos: count("vencido"),
      },
      items: {
        total: allItems.length,
        hechos,
        fallidos,
        pendientes: allItems.length - hechos - fallidos,
        cumplimiento: allItems.length ? Math.round((hechos / allItems.length) * 100) : null,
      },
      seguimientos: {
        asignados: seguimientos.length,
        completados: segCompletados,
        vencidos: segVencidos,
        tasaResolucion: seguimientos.length ? Math.round((segCompletados / seguimientos.length) * 100) : null,
      },
      visitas: visitas.length,
      acciones,
      contactosTomados: contactos.length,
      clientesCreados: clientes.length,
      propiedadesACargo,
      tasaciones,
      actividadPorDia: Math.round((actividad / dias) * 10) / 10,
    },
    objetivos,
    visitas: visitas.map((v) => ({
      fecha: v.date,
      hora: [v.startTime, v.endTime].filter(Boolean).join("–"),
      tipo: v.type,
      titulo: v.title,
      propiedad: v.property?.address ?? null,
      cliente: v.client?.name ?? null,
    })),
    seguimientos: seguimientos.map((s) => ({
      propiedad: s.property.address,
      titulo: s.title,
      estado: s.status,
      vence: s.dueDate,
      acciones: s._count.actions,
    })),
    accionesPorTipo,
    contactos: contactos.map((c) => ({
      fecha: c.updatedAt,
      portal: c.portal,
      nombre: c.clientId ? (clientName.get(c.clientId) ?? null) : null,
      propiedad: c.followUpId ? (fuAddress.get(c.followUpId) ?? null) : null,
    })),
    clientes: clientes.map((c) => ({ nombre: c.name, fecha: c.createdAt })),
  };
}
