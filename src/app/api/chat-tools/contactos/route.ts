import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { getInboxMessages, getInboxMessageById } from "@/lib/messages/inbox";
import { applyContactAction, type ContactAction } from "@/lib/messages/contact-actions";

// Tools del chat IA: central de mensajes.
//  - GET: últimos contactos (solo lectura), con `id` para poder actuar.
//  - POST: tomar / pasar a espera / restaurar / transferir un contacto
//    (misma lógica que las tarjetas de la web). Confirmación del lado del chat.
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const estado = (sp.get("estado") ?? "nuevos").trim();
  const portal = (sp.get("portal") ?? "").trim();
  const q = (sp.get("q") ?? "").trim();
  const limit = Math.min(20, Math.max(1, Number.parseInt(sp.get("limite") ?? "10", 10) || 10));

  const { items, total, counts } = await getInboxMessages({ estado, portal, q, page: 1, limit });

  // Conteos por estado de gestión (para el resumen del bot).
  const cases = await prisma.contactCase.groupBy({ by: ["status"], _count: true });
  const porEstado: Record<string, number> = { tomado: 0, espera: 0, descartado: 0 };
  for (const c of cases) porEstado[c.status] = c._count;

  const contactos = items.map((m) => ({
    id: m.id,
    nombre: m.name,
    portal: m.portal,
    propiedad: m.propertyAddress ?? m.propertyTitle,
    mensaje: m.message ? m.message.slice(0, 180) : null,
    telefono: m.phone,
    email: m.email,
    fecha: m.date,
    estado: m.caseStatus ?? "nuevo",
    atiende: m.takenByName,
  }));

  return ok(
    { totalFiltrado: total, porPortal: counts, gestion: porEstado, contactos, centralUrl: `${siteUrl()}/consultants` },
    "Contactos",
    request.nextUrl.pathname
  );
});

const ACCIONES: Record<string, ContactAction> = {
  tomar: "take",
  espera: "wait",
  restaurar: "restore",
  transferir: "transfer",
};

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as { contactoId?: string; accion?: string; paraEmail?: string };
  const contactoId = (body.contactoId ?? "").trim();
  const accion = ACCIONES[(body.accion ?? "").trim().toLowerCase()];
  if (!contactoId.includes(":")) throw new AppError(400, "Falta contactoId (campo `id` de ver_contactos, formato portal:id)");
  if (!accion) throw new AppError(400, `Acción inválida: "${body.accion}" (tomar, espera, restaurar o transferir)`);

  const msg = await getInboxMessageById(contactoId);
  if (!msg) throw new AppError(404, "Contacto no encontrado");

  let toUserId: string | undefined;
  if (accion === "transfer") {
    const email = (body.paraEmail ?? "").trim().toLowerCase();
    if (!email) throw new AppError(400, "Para transferir indicá paraEmail (email del usuario destino)");
    const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (!u) {
      const users = await prisma.user.findMany({ select: { email: true, fullName: true } });
      throw new AppError(404, `No hay usuario con email ${email}. Usuarios: ${users.map((x) => `${x.fullName ?? "?"} <${x.email}>`).join("; ")}`);
    }
    toUserId = u.id;
  }

  const { data, message } = await applyContactAction({ messageId: contactoId, action: accion, toUserId }, { userId: who.userId, isAdmin: who.isAdmin });
  console.log(`[chat-tools] ${who.email} ${body.accion} contacto ${contactoId}`);
  return ok(
    { contacto: { id: msg.id, nombre: msg.name, portal: msg.portal, propiedad: msg.propertyAddress ?? msg.propertyTitle }, ...data, centralUrl: `${siteUrl()}/consultants` },
    `${msg.name ?? "Contacto"} (${msg.portal}): ${message}`,
    request.nextUrl.pathname
  );
});
