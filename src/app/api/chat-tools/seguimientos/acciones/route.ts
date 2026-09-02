import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";

// Tool del chat IA: agrega una ACCIÓN (nota, visita, llamada, mensaje) a un
// seguimiento, y opcionalmente lo marca como hecho. El seguimiento se
// identifica por id o por propiedad (los abiertos del usuario; admin: todos).
// Requiere confirmación en el chat.
const TIPOS = ["nota", "visita", "llamada", "mensaje", "otro"] as const;

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as {
    followUpId?: string;
    propertyId?: string;
    referencia?: string;
    direccion?: string;
    tipo?: string;
    descripcion?: string;
    fecha?: string;
    mostradoA?: string;
    marcarHecho?: boolean;
  };
  const tipo = (body.tipo ?? "nota").trim().toLowerCase();
  if (!(TIPOS as readonly string[]).includes(tipo)) throw new AppError(400, `Tipo inválido: ${body.tipo} (${TIPOS.join(", ")})`);
  const descripcion = (body.descripcion ?? "").trim();
  if (!descripcion) throw new AppError(400, "Falta la descripción de la acción");

  const visibles = who.isAdmin ? {} : { assignedToUserId: who.userId };
  let followUpId = body.followUpId?.trim();
  if (!followUpId) {
    const prop = await resolveProperty(body);
    const abiertos = await prisma.propertyFollowUp.findMany({
      where: { propertyId: prop.id, status: { notIn: ["hecho", "cancelado"] }, ...visibles },
      select: { id: true, title: true, dueDate: true, assignedToUser: { select: { fullName: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });
    if (!abiertos.length) throw new AppError(404, `${prop.direccion} no tiene seguimientos abiertos${who.isAdmin ? "" : " asignados a vos"}. Podés crear uno con crear_seguimiento.`);
    if (abiertos.length > 1) {
      const lista = abiertos.map((f) => `"${f.title ?? "sin título"}" de ${f.assignedToUser.fullName ?? f.assignedToUser.email} [followUpId ${f.id}]`).join("; ");
      throw new AppError(409, `Hay ${abiertos.length} seguimientos abiertos para ${prop.direccion}; preguntale cuál y reintentá con followUpId. ${lista}`);
    }
    followUpId = abiertos[0].id;
  }

  const fu = await prisma.propertyFollowUp.findFirst({
    where: { id: followUpId, ...visibles },
    select: { id: true, status: true, title: true, property: { select: { address: true } } },
  });
  if (!fu) throw new AppError(404, "Seguimiento no encontrado (o no es tuyo)");

  let actionAt = new Date();
  if (body.fecha?.trim()) {
    actionAt = new Date(body.fecha.trim().length <= 10 ? `${body.fecha.trim()}T12:00:00` : body.fecha.trim());
    if (Number.isNaN(actionAt.getTime())) throw new AppError(400, "Fecha inválida");
  }

  await prisma.followUpAction.create({
    data: {
      followUpId: fu.id,
      type: tipo,
      description: descripcion,
      actionAt,
      shownToName: body.mostradoA?.trim() || null,
      createdByUserId: who.userId,
    },
  });
  let estado = fu.status;
  if (body.marcarHecho === true && fu.status !== "hecho") {
    await prisma.propertyFollowUp.update({ where: { id: fu.id }, data: { status: "hecho" } });
    estado = "hecho";
  }

  return created(
    { followUpId: fu.id, propiedad: fu.property.address, seguimiento: fu.title, tipo, estado, seguimientosUrl: `${siteUrl()}/seguimientos` },
    `${tipo === "nota" ? "Nota" : tipo[0].toUpperCase() + tipo.slice(1)} agregada al seguimiento de ${fu.property.address}${estado === "hecho" ? " (marcado como hecho)" : ""}`,
    request.nextUrl.pathname
  );
});
