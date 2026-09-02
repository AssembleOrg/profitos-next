import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";

// Tools del chat IA: seguimientos de propiedades.
//  - GET: lista (solo lectura).
//  - POST: crea un seguimiento. Admin: asigna a cualquiera; empleado: sólo a
//    sí mismo. Requiere confirmación en el chat.
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const soloVencidos = sp.get("vencidos") === "true";
  const email = (sp.get("responsableEmail") ?? "").trim();
  const limit = Math.min(30, Math.max(1, Number.parseInt(sp.get("limite") ?? "15", 10) || 15));

  const and: object[] = [{ status: { notIn: ["hecho", "cancelado"] } }];
  if (soloVencidos) and.push({ dueDate: { lt: new Date() } });
  if (email) and.push({ assignedToUser: { email: { equals: email, mode: "insensitive" } } });

  const rows = await prisma.propertyFollowUp.findMany({
    where: { AND: and },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      notes: true,
      property: { select: { address: true } },
      assignedToUser: { select: { fullName: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  const seguimientos = rows.map((r) => ({
    id: r.id,
    propiedad: r.property.address,
    titulo: r.title,
    estado: r.status,
    vence: r.dueDate,
    responsable: r.assignedToUser.fullName?.trim() || r.assignedToUser.email,
    notas: r.notes ? r.notes.slice(0, 150) : null,
  }));

  return ok({ cantidad: seguimientos.length, seguimientos, seguimientosUrl: `${siteUrl()}/seguimientos` }, "Seguimientos", request.nextUrl.pathname);
});

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as {
    propertyId?: string;
    referencia?: string;
    direccion?: string;
    asignadoEmail?: string;
    titulo?: string;
    notas?: string;
    vence?: string;
  };
  const prop = await resolveProperty(body);

  let assignedToUserId = who.userId;
  const asignado = (body.asignadoEmail ?? "").trim().toLowerCase();
  if (asignado && asignado !== who.email.toLowerCase()) {
    if (!who.isAdmin) throw new AppError(403, "Sólo un admin puede asignar seguimientos a otra persona; podés crearlo para vos.");
    const u = await prisma.user.findFirst({ where: { email: { equals: asignado, mode: "insensitive" } }, select: { id: true } });
    if (!u) {
      const users = await prisma.user.findMany({ select: { email: true, fullName: true } });
      throw new AppError(404, `No hay usuario con email ${asignado}. Usuarios: ${users.map((x) => `${x.fullName ?? "?"} <${x.email}>`).join("; ")}`);
    }
    assignedToUserId = u.id;
  }

  let dueDate: Date | null = null;
  if (body.vence?.trim()) {
    dueDate = new Date(`${body.vence.trim()}T12:00:00`);
    if (Number.isNaN(dueDate.getTime())) throw new AppError(400, "Fecha de vencimiento inválida (YYYY-MM-DD)");
  }

  const fu = await prisma.propertyFollowUp.create({
    data: {
      propertyId: prop.id,
      assignedToUserId,
      assignedByUserId: who.userId,
      title: body.titulo?.trim() || null,
      notes: body.notas?.trim() || null,
      status: "pendiente",
      dueDate,
    },
    select: { id: true, assignedToUser: { select: { fullName: true, email: true } } },
  });

  return created(
    {
      id: fu.id,
      propiedad: prop.direccion,
      titulo: body.titulo?.trim() || null,
      responsable: fu.assignedToUser.fullName?.trim() || fu.assignedToUser.email,
      vence: body.vence?.trim() || null,
      seguimientosUrl: `${siteUrl()}/seguimientos`,
    },
    `Seguimiento creado para ${prop.direccion}`,
    request.nextUrl.pathname
  );
});
