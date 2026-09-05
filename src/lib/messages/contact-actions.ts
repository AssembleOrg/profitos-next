import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import { toWhatsAppNumber, firstPhone } from "@/lib/whatsapp";
import { findClientByContact } from "@/lib/clients/match";

/**
 * Acciones sobre un contacto de la central de mensajes. Compartido por la API
 * de la web (tarjetas / modo repaso) y las tools del chat IA.
 *  - take: lo tomo yo (el primero gana). Crea/reusa el CLIENTE (match por
 *    teléfono o email para no duplicar) y, si el contacto tiene propiedad
 *    nuestra, crea un SEGUIMIENTO asignado a mí.
 *  - wait: lo aparta a "espera" (si en 3 días nadie lo toma → descartado).
 *  - restore: espera/descartado → vuelve a "nuevo".
 *  - transfer: el que lo tomó (o un admin) lo pasa a otro usuario; el
 *    seguimiento asociado se reasigna.
 */
export const CONTACT_ACTIONS = ["take", "wait", "transfer", "restore"] as const;
export type ContactAction = (typeof CONTACT_ACTIONS)[number];

export type ContactActor = { userId: string; isAdmin: boolean };

export type ContactActionResult = { data: Record<string, unknown>; message: string };

export async function applyContactAction(
  input: { messageId: string; action: ContactAction; toUserId?: string },
  actor: ContactActor
): Promise<ContactActionResult> {
  const messageId = input.messageId.trim();
  const action = input.action;
  if (!messageId.includes(":")) throw new AppError(400, "messageId inválido");
  if (!CONTACT_ACTIONS.includes(action)) throw new AppError(400, "Acción inválida");

  const [portal, rowId] = [messageId.slice(0, messageId.indexOf(":")), messageId.slice(messageId.indexOf(":") + 1)];
  const existing = await prisma.contactCase.findUnique({
    where: { id: messageId },
    include: { takenByUser: { select: { fullName: true, email: true } } },
  });

  // ───── espera ─────
  if (action === "wait") {
    if (existing?.status === "tomado") throw new AppError(409, "Ya fue tomado; no se puede pasar a espera");
    await prisma.contactCase.upsert({
      where: { id: messageId },
      create: { id: messageId, portal, status: "espera", waitingAt: new Date() },
      update: { status: "espera", waitingAt: new Date() },
    });
    return { data: { status: "espera" }, message: "Contacto en espera (se descarta solo en 3 días si nadie lo toma)" };
  }

  // ───── restore ───── (espera/descartado → vuelve a "nuevo"; deshace confusiones)
  if (action === "restore") {
    if (!existing) return { data: { status: null }, message: "El contacto ya estaba como nuevo" };
    if (existing.status === "tomado") throw new AppError(409, "Está tomado; para liberarlo transferilo o gestioná el seguimiento");
    await prisma.contactCase.delete({ where: { id: messageId } });
    return { data: { status: null }, message: "Contacto restaurado a nuevos" };
  }

  // ───── transfer ─────
  if (action === "transfer") {
    if (!existing || existing.status !== "tomado") throw new AppError(400, "El contacto no está tomado");
    if (existing.takenByUserId !== actor.userId && !actor.isAdmin) {
      throw new AppError(403, "Sólo quien lo tomó (o un admin) puede transferirlo");
    }
    const toUserId = (input.toUserId ?? "").trim();
    const target = toUserId ? await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, fullName: true, email: true } }) : null;
    if (!target) throw new AppError(400, "Usuario destino inválido");
    await prisma.contactCase.update({ where: { id: messageId }, data: { takenByUserId: target.id } });
    if (existing.followUpId) {
      await prisma.propertyFollowUp
        .update({ where: { id: existing.followUpId }, data: { assignedToUserId: target.id, assignedByUserId: actor.userId } })
        .catch(() => {});
    }
    return {
      data: { status: "tomado", takenByUserId: target.id },
      message: `Transferido a ${target.fullName?.trim() || target.email}`,
    };
  }

  // ───── take ─────
  if (existing?.status === "tomado") {
    const who = existing.takenByUser?.fullName?.trim() || existing.takenByUser?.email || "otro usuario";
    throw new AppError(409, `Ya lo tomó ${who}`);
  }

  // Datos del contacto según la fuente.
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let message: string | null = null;
  let propertyId: string | null = null;
  let propertyAddress: string | null = null;

  if (portal === "mercadolibre") {
    const q = await prisma.portalQuestion.findUnique({ where: { id: rowId } });
    if (!q) throw new AppError(404, "Contacto no encontrado");
    message = q.text;
    propertyId = q.propertyId;
    if (propertyId) {
      const p = await prisma.property.findUnique({ where: { id: propertyId }, select: { address: true } });
      propertyAddress = p?.address ?? null;
    }
  } else {
    const lead = await prisma.scrapedLead.findUnique({ where: { id: rowId } });
    if (!lead) throw new AppError(404, "Contacto no encontrado");
    name = lead.contactName;
    email = lead.contactEmail;
    phone = lead.contactPhone;
    message = lead.messageText;
    if (lead.propertyRef) {
      const p = await prisma.property.findFirst({
        where: { referenceCode: lead.propertyRef },
        select: { id: true, address: true },
      });
      propertyId = p?.id ?? null;
      propertyAddress = p?.address ?? null;
    }
  }

  // Cliente: inferir por teléfono normalizado o email antes de crear (evita duplicados).
  const waPhone = toWhatsAppNumber(phone);
  let client: { id: string; name: string } | null = await findClientByContact(email, phone);
  let clientCreated = false;
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: name?.trim() || `Contacto ${portal}`,
        phone: waPhone || firstPhone(phone) || null,
        email: email || null,
        notes: [`Origen: consulta en ${portal}`, propertyAddress ? `Propiedad: ${propertyAddress}` : null, message ? `Mensaje: ${message}` : null]
          .filter(Boolean)
          .join("\n"),
        userId: actor.userId,
      },
      select: { id: true, name: true },
    });
    clientCreated = true;
  }

  // Seguimiento sobre la propiedad (si el contacto tiene propiedad nuestra).
  let followUpId: string | null = null;
  if (propertyId) {
    const fu = await prisma.propertyFollowUp.create({
      data: {
        propertyId,
        assignedToUserId: actor.userId,
        assignedByUserId: actor.userId,
        clientId: client.id,
        title: `Consulta ${portal}: ${name?.trim() || client.name}`,
        // Tel/email viven en el cliente vinculado; acá solo el mensaje.
        notes: message ? `Mensaje: ${message}` : null,
      },
      select: { id: true },
    });
    followUpId = fu.id;
  }

  await prisma.contactCase.upsert({
    where: { id: messageId },
    create: { id: messageId, portal, status: "tomado", takenByUserId: actor.userId, clientId: client.id, followUpId },
    update: { status: "tomado", takenByUserId: actor.userId, clientId: client.id, followUpId, waitingAt: null },
  });

  return {
    data: { status: "tomado", clientId: client.id, clientName: client.name, clientCreated, followUpId, propertyAddress },
    message: followUpId
      ? `Tomado: cliente ${clientCreated ? "creado" : "existente"} + seguimiento asignado a vos`
      : `Tomado: cliente ${clientCreated ? "creado" : "existente"} (sin propiedad vinculada, no se creó seguimiento)`,
  };
}
