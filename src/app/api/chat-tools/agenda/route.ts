import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";
import { createCalendarEvent, getValidGoogleToken } from "@/lib/google/calendar";

// Tools del chat IA para la AGENDA (visitas y eventos).
//  - GET: visitas en un rango (default: hoy → 7 días). Empleado: las suyas;
//    admin: todas, o las de un email puntual.
//  - POST: crea una visita para el usuario actual (+ evento en su Google
//    Calendar si tiene la cuenta conectada). Requiere confirmación en el chat.
const TIPOS = ["visita", "firma", "tasacion", "otro", "firma_informes", "firma_acordada", "entrega_llaves"] as const;

function day(raw: string | null | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `Fecha inválida: ${raw} (usar YYYY-MM-DD)`);
  return d;
}

export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const sp = request.nextUrl.searchParams;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = day(sp.get("desde"), today);
  const toDefault = new Date(from);
  toDefault.setDate(toDefault.getDate() + 7);
  const to = day(sp.get("hasta"), toDefault);
  to.setHours(23, 59, 59, 999);
  const limit = Math.min(50, Math.max(1, Number.parseInt(sp.get("limite") ?? "25", 10) || 25));

  const email = (sp.get("email") ?? "").trim().toLowerCase();
  const todos = sp.get("todos") === "true";
  let userFilter: string | undefined = who.userId;
  if (who.isAdmin && (todos || email)) {
    if (email) {
      const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
      if (!u) throw new AppError(404, `No hay usuario con email ${email}`);
      userFilter = u.id;
    } else {
      userFilter = undefined;
    }
  }

  const rows = await prisma.visit.findMany({
    where: { date: { gte: from, lte: to }, ...(userFilter ? { userId: userFilter } : {}) },
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      startTime: true,
      endTime: true,
      type: true,
      property: { select: { address: true } },
      client: { select: { name: true, phone: true } },
      user: { select: { fullName: true, email: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: limit,
  });

  const visitas = rows.map((v) => ({
    id: v.id,
    fecha: v.date.toISOString().slice(0, 10),
    hora: `${v.startTime}–${v.endTime}`,
    tipo: v.type,
    titulo: v.title,
    propiedad: v.property?.address ?? null,
    cliente: v.client ? `${v.client.name}${v.client.phone ? ` (${v.client.phone})` : ""}` : null,
    responsable: v.user.fullName?.trim() || v.user.email,
    notas: v.description ? v.description.slice(0, 160) : null,
  }));
  return ok({ desde: from.toISOString().slice(0, 10), hasta: to.toISOString().slice(0, 10), cantidad: visitas.length, visitas, agendaUrl: `${siteUrl()}/agenda` }, "Agenda", request.nextUrl.pathname);
});

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as {
    titulo?: string;
    fecha?: string;
    horaInicio?: string;
    horaFin?: string;
    tipo?: string;
    descripcion?: string;
    propertyId?: string;
    referencia?: string;
    direccion?: string;
    clienteNombre?: string;
  };

  const fecha = (body.fecha ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new AppError(400, "Falta fecha (YYYY-MM-DD)");
  const hi = (body.horaInicio ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(hi)) throw new AppError(400, "Falta horaInicio (HH:MM)");
  let hf = (body.horaFin ?? "").trim();
  if (!hf) {
    // default: 1 hora
    const [h, m] = hi.split(":").map(Number);
    hf = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (!/^\d{1,2}:\d{2}$/.test(hf)) throw new AppError(400, "horaFin inválida (HH:MM)");
  const tipo = (body.tipo ?? "visita").trim().toLowerCase();
  if (!(TIPOS as readonly string[]).includes(tipo)) throw new AppError(400, `Tipo inválido: ${body.tipo} (${TIPOS.join(", ")})`);

  const prop = body.propertyId || body.referencia || body.direccion ? await resolveProperty(body) : null;

  let clientId: string | null = null;
  let clienteNombre: string | null = null;
  if (body.clienteNombre?.trim()) {
    const c = await prisma.client.findFirst({
      where: { name: { contains: body.clienteNombre.trim(), mode: "insensitive" } },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    });
    if (c) {
      clientId = c.id;
      clienteNombre = c.name;
    } else {
      clienteNombre = body.clienteNombre.trim();
    }
  }

  const titulo = body.titulo?.trim() || [tipo === "visita" ? "Visita" : tipo.replace(/_/g, " "), prop?.direccion, clienteNombre].filter(Boolean).join(" · ");

  // Google Calendar del usuario (si conectó su cuenta): mismo comportamiento que la web.
  let googleEventId: string | null = null;
  try {
    const token = await getValidGoogleToken(who.userId);
    if (token) {
      const { eventId } = await createCalendarEvent(token, {
        title: titulo,
        description: body.descripcion,
        date: fecha,
        startTime: hi,
        endTime: hf,
        location: prop?.direccion,
      });
      googleEventId = eventId;
    }
  } catch (e) {
    console.warn("[chat-tools] agenda: google calendar falló:", e instanceof Error ? e.message : e);
  }

  const visit = await prisma.visit.create({
    data: {
      title: titulo,
      description: body.descripcion?.trim() || null,
      date: new Date(`${fecha}T00:00:00`),
      startTime: hi,
      endTime: hf,
      type: tipo,
      propertyId: prop?.id ?? null,
      clientId,
      googleEventId,
      userId: who.userId,
    },
    select: { id: true },
  });

  return created(
    {
      id: visit.id,
      titulo,
      fecha,
      hora: `${hi}–${hf}`,
      tipo,
      propiedad: prop?.direccion ?? null,
      cliente: clienteNombre,
      clienteVinculado: Boolean(clientId),
      googleCalendar: Boolean(googleEventId),
      agendaUrl: `${siteUrl()}/agenda`,
    },
    `Agendado: ${titulo} el ${fecha} ${hi}–${hf}${googleEventId ? " (también en Google Calendar)" : ""}`,
    request.nextUrl.pathname
  );
});
