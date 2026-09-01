import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth } from "@/lib/api/chat-tools";

// Tools del chat IA para OBJETIVOS: consultar y crear (la única escritura
// permitida al bot por ahora).

export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const email = (sp.get("asignadoEmail") ?? "").trim();
  const soloVigentes = sp.get("vigentes") !== "false"; // default: solo vigentes
  const limit = Math.min(30, Math.max(1, Number.parseInt(sp.get("limite") ?? "15", 10) || 15));

  const and: object[] = [];
  if (email) and.push({ assignedToUser: { email: { equals: email, mode: "insensitive" } } });
  if (soloVigentes) {
    const hoy = new Date();
    and.push({ startDate: { lte: hoy } }, { endDate: { gte: hoy } });
  }

  const cards = await prisma.objectiveCard.findMany({
    where: { AND: and },
    select: {
      title: true,
      description: true,
      startDate: true,
      endDate: true,
      statusOverride: true,
      assignedToUser: { select: { fullName: true, email: true } },
      items: { select: { text: true, status: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ startDate: "desc" }],
    take: limit,
  });

  const objetivos = cards.map((c) => ({
    titulo: c.title,
    descripcion: c.description,
    desde: c.startDate,
    hasta: c.endDate,
    asignado: c.assignedToUser.fullName?.trim() || c.assignedToUser.email,
    progreso: `${c.items.filter((i) => i.status === "done").length}/${c.items.length} items`,
    items: c.items.map((i) => ({ texto: i.text, estado: i.status })),
  }));

  return ok({ cantidad: objetivos.length, objetivos }, "Objetivos", request.nextUrl.pathname);
});

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const body = (await request.json().catch(() => ({}))) as {
    titulo?: string;
    descripcion?: string;
    fechaInicio?: string;
    fechaFin?: string;
    asignadosEmails?: string[];
    items?: string[];
    solicitanteEmail?: string;
  };

  const titulo = (body.titulo ?? "").trim();
  if (!titulo) throw new AppError(400, "Falta el título del objetivo");
  const start = new Date(body.fechaInicio ?? "");
  const end = new Date(body.fechaFin ?? "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError(400, "Fechas inválidas (usar YYYY-MM-DD)");
  }
  if (start > end) throw new AppError(400, "La fecha de inicio no puede ser posterior a la de fin");

  const solicitante = (body.solicitanteEmail ?? "").trim();
  const creador = solicitante
    ? await prisma.user.findFirst({ where: { email: { equals: solicitante, mode: "insensitive" } }, select: { id: true } })
    : null;
  if (!creador) {
    const users = await prisma.user.findMany({ select: { email: true, fullName: true } });
    throw new AppError(
      400,
      `Falta identificar al solicitante. Pedile su email y reintentá con solicitanteEmail. Usuarios: ${users
        .map((u) => `${u.fullName ?? "?"} <${u.email}>`)
        .join("; ")}`
    );
  }

  const emails = (body.asignadosEmails ?? []).map((e) => e.trim()).filter(Boolean);
  if (!emails.length) throw new AppError(400, "Falta asignadosEmails (al menos un usuario)");
  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (users.length !== emails.length) {
    const found = new Set(users.map((u) => u.email.toLowerCase()));
    const missing = emails.filter((e) => !found.has(e.toLowerCase()));
    throw new AppError(404, `Usuarios no encontrados: ${missing.join(", ")}`);
  }

  const cleanItems = (body.items ?? []).map((t) => t.trim()).filter(Boolean);
  const cards = await prisma.$transaction(
    users.map((u) =>
      prisma.objectiveCard.create({
        data: {
          title: titulo,
          description: body.descripcion?.trim() || null,
          startDate: start,
          endDate: end,
          assignedToUserId: u.id,
          createdByUserId: creador.id,
          items: { create: cleanItems.map((text, i) => ({ text, position: i })) },
        },
        select: { id: true, assignedToUser: { select: { email: true } } },
      })
    )
  );

  return created(
    { creados: cards.length, asignados: cards.map((c) => c.assignedToUser.email) },
    `Objetivo "${titulo}" creado para ${cards.length} usuario(s)`,
    request.nextUrl.pathname
  );
});
