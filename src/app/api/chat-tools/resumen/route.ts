import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { getInboxMessages } from "@/lib/messages/inbox";
import { zonapropCreditsAlert } from "@/lib/publish/credits-alert";
import { getDueEffectiveStatus } from "@/lib/rentals";

// Tool del chat IA: RESUMEN DEL DÍA para el usuario actual (admin: global).
// Junta en una sola llamada lo que hay que mirar al arrancar: contactos nuevos
// y en espera por vencer, seguimientos vencidos, agenda de hoy, objetivos en
// riesgo, cupo de ZonaProp, portales desconectados y cuotas de alquiler
// vencidas. Solo lectura.
const WAIT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const now = new Date();
  const hoy0 = new Date(now);
  hoy0.setHours(0, 0, 0, 0);
  const hoy1 = new Date(now);
  hoy1.setHours(23, 59, 59, 999);
  const mine = who.isAdmin ? {} : { assignedToUserId: who.userId };

  const [inbox, esperaPorVencer, segVencidos, segHoy, visitasHoy, objetivos, sessions, mlToken, cupo, dues] = await Promise.all([
    getInboxMessages({ estado: "nuevos", page: 1, limit: 5, mine: !who.isAdmin }, { userId: who.userId, isAdmin: who.isAdmin }),
    prisma.contactCase.count({ where: { status: "espera", waitingAt: { lt: new Date(now.getTime() - WAIT_TTL_MS + 24 * 3600_000) } } }),
    prisma.propertyFollowUp.findMany({
      where: { ...mine, status: { notIn: ["hecho", "cancelado"] }, dueDate: { lt: hoy0 } },
      select: { title: true, dueDate: true, property: { select: { address: true } }, assignedToUser: { select: { fullName: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.propertyFollowUp.count({ where: { ...mine, status: { notIn: ["hecho", "cancelado"] }, dueDate: { gte: hoy0, lte: hoy1 } } }),
    prisma.visit.findMany({
      where: { date: { gte: hoy0, lte: hoy1 }, ...(who.isAdmin ? {} : { userId: who.userId }) },
      select: { startTime: true, endTime: true, type: true, title: true, property: { select: { address: true } }, user: { select: { fullName: true } } },
      orderBy: { startTime: "asc" },
      take: 12,
    }),
    prisma.objectiveCard.findMany({
      where: { ...mine, startDate: { lte: now }, endDate: { gte: hoy0 } },
      select: { title: true, endDate: true, assignedToUser: { select: { fullName: true } }, items: { select: { status: true } } },
      orderBy: { endDate: "asc" },
      take: 10,
    }),
    prisma.scraperSession.findMany({ select: { portal: true, valid: true } }),
    prisma.portalToken.findUnique({ where: { portal: "mercadolibre" }, select: { id: true } }),
    zonapropCreditsAlert(),
    who.isAdmin
      ? prisma.rentalDueDate.findMany({
          where: { dueDate: { gte: new Date(now.getTime() - 400 * 86_400_000), lte: hoy1 } },
          select: { dueDate: true, status: true, expectedAmount: true, transactions: { select: { amountPaid: true } }, contract: { select: { gracePeriodDays: true } } },
        })
      : Promise.resolve([]),
  ]);

  const cuotasVencidas = dues.filter((d) => {
    const cobrado = d.transactions.reduce((a, t) => a + t.amountPaid, 0);
    return getDueEffectiveStatus({ dueDate: d.dueDate, status: d.status, gracePeriodDays: d.contract.gracePeriodDays, expectedAmount: d.expectedAmount, collected: cobrado }) === "vencido";
  }).length;

  const desconectados = [
    ...sessions.filter((s) => !s.valid).map((s) => s.portal),
    ...(mlToken ? [] : ["mercadolibre"]),
  ];

  const objetivosEnRiesgo = objetivos
    .map((o) => {
      const total = o.items.length;
      const done = o.items.filter((i) => i.status === "done").length;
      const dias = Math.ceil((o.endDate.getTime() - hoy0.getTime()) / 86_400_000);
      return { titulo: o.title, asignado: o.assignedToUser.fullName, progreso: `${done}/${total}`, venceEnDias: dias, pendientes: total - done };
    })
    .filter((o) => o.pendientes > 0);

  const alertas: string[] = [];
  if (inbox.total) alertas.push(`${inbox.total} contacto(s) nuevo(s) sin tomar`);
  if (esperaPorVencer) alertas.push(`${esperaPorVencer} en espera se descartan en menos de 24h`);
  if (segVencidos.length) alertas.push(`${segVencidos.length} seguimiento(s) vencido(s)`);
  if (cupo.enAlerta.length) alertas.push(`cupo ZonaProp bajo: ${cupo.enAlerta.map((a) => `${a.plan} ${a.disponibles}`).join(", ")}`);
  if (desconectados.length) alertas.push(`portal(es) desconectado(s): ${desconectados.join(", ")}`);
  if (cuotasVencidas) alertas.push(`${cuotasVencidas} cuota(s) de alquiler vencida(s)`);
  if (objetivosEnRiesgo.some((o) => o.venceEnDias <= 3)) alertas.push("objetivos con items pendientes que vencen en ≤3 días");

  return ok(
    {
      para: who.fullName ?? who.email,
      alcance: who.isAdmin ? "global (admin)" : "lo mío",
      fecha: hoy0.toISOString().slice(0, 10),
      alertas,
      contactos: {
        nuevos: inbox.total,
        ultimos: inbox.items.slice(0, 5).map((m) => ({ portal: m.portal, nombre: m.name, propiedad: m.propertyAddress ?? m.propertyTitle, mensaje: m.message?.slice(0, 100) ?? null })),
        enEsperaPorVencer: esperaPorVencer,
        url: `${siteUrl()}/consultants`,
      },
      seguimientos: {
        vencidos: segVencidos.map((s) => ({ propiedad: s.property.address, titulo: s.title, vencio: s.dueDate?.toISOString().slice(0, 10), responsable: s.assignedToUser.fullName })),
        vencenHoy: segHoy,
      },
      agendaHoy: visitasHoy.map((v) => ({ hora: `${v.startTime}–${v.endTime}`, tipo: v.type, titulo: v.title, propiedad: v.property?.address ?? null, responsable: v.user.fullName })),
      objetivosEnRiesgo,
      portales: { desconectados, cupoZonaprop: cupo.planes.map((p) => `${p.label || p.plan}: ${p.available ?? "?"}${p.total != null ? `/${p.total}` : ""}`), alertaCupo: cupo.enAlerta.length > 0 },
      alquileres: who.isAdmin ? { cuotasVencidas } : null,
    },
    "Resumen del día",
    request.nextUrl.pathname
  );
});
