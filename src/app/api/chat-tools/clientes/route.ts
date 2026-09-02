import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { buildContactWhatsAppLink, firstPhone } from "@/lib/whatsapp";

// Tools del chat IA: CLIENTES.
//  - GET: busca por nombre, teléfono o email → datos, historial (visitas,
//    contactos tomados, seguimientos vinculados) y link de WhatsApp.
//  - POST: crea un cliente (evita duplicados por teléfono/email). Confirmación.
function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) throw new AppError(400, "Indicá nombre, teléfono o email (mínimo 2 caracteres)");
  const qd = digits(q);

  const rows = await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(qd.length >= 6 ? [{ phone: { contains: qd.slice(-8) } }] : []),
        { phone: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      notes: true,
      createdAt: true,
      user: { select: { fullName: true, email: true } },
      visitas: { select: { date: true, title: true, type: true, property: { select: { address: true } } }, orderBy: { date: "desc" }, take: 5 },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  const ids = rows.map((r) => r.id);
  const cases = ids.length
    ? await prisma.contactCase.findMany({
        where: { clientId: { in: ids } },
        select: { clientId: true, portal: true, status: true, updatedAt: true, followUpId: true },
      })
    : [];
  const fuIds = [...new Set(cases.map((c) => c.followUpId).filter((x): x is string => Boolean(x)))];
  const fus = fuIds.length
    ? await prisma.propertyFollowUp.findMany({
        where: { id: { in: fuIds } },
        select: { id: true, status: true, title: true, property: { select: { address: true } } },
      })
    : [];
  const fuMap = new Map(fus.map((f) => [f.id, f]));

  const clientes = rows.map((c) => {
    const phone = firstPhone(c.phone);
    const cs = cases.filter((x) => x.clientId === c.id);
    return {
      id: c.id,
      nombre: c.name,
      telefono: c.phone,
      email: c.email,
      whatsapp: phone ? buildContactWhatsAppLink(phone) : null,
      creadoPor: c.user.fullName?.trim() || c.user.email,
      desde: c.createdAt.toISOString().slice(0, 10),
      notas: c.notes ? c.notes.slice(0, 200) : null,
      visitas: c.visitas.map((v) => ({ fecha: v.date.toISOString().slice(0, 10), tipo: v.type, titulo: v.title, propiedad: v.property?.address ?? null })),
      contactos: cs.map((x) => ({ portal: x.portal, estado: x.status, fecha: x.updatedAt.toISOString().slice(0, 10) })),
      seguimientos: cs
        .map((x) => (x.followUpId ? fuMap.get(x.followUpId) : null))
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
        .map((f) => ({ propiedad: f.property.address, titulo: f.title, estado: f.status })),
    };
  });

  return ok({ cantidad: clientes.length, clientes, clientesUrl: `${siteUrl()}/contactos` }, "Clientes", request.nextUrl.pathname);
});

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as { nombre?: string; telefono?: string; email?: string; notas?: string; forzar?: boolean };
  const nombre = (body.nombre ?? "").trim();
  if (!nombre) throw new AppError(400, "Falta el nombre del cliente");
  const telefono = body.telefono?.trim() || null;
  const email = body.email?.trim().toLowerCase() || null;

  if (!body.forzar) {
    const td = digits(telefono);
    const dup = await prisma.client.findFirst({
      where: {
        OR: [
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(td.length >= 8 ? [{ phone: { contains: td.slice(-8) } }] : []),
        ],
      },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (dup) {
      throw new AppError(409, `Ya existe un cliente con ese teléfono/email: ${dup.name} (${dup.phone ?? "sin tel"}, ${dup.email ?? "sin email"}) [id ${dup.id}]. Preguntale al usuario si es el mismo; si quiere crearlo igual, reintentá con forzar=true.`);
    }
  }

  const c = await prisma.client.create({
    data: { name: nombre, phone: telefono, email, notes: body.notas?.trim() || null, userId: who.userId },
    select: { id: true },
  });
  const phone = firstPhone(telefono);
  return created(
    { id: c.id, nombre, telefono, email, whatsapp: phone ? buildContactWhatsAppLink(phone) : null, clientesUrl: `${siteUrl()}/contactos` },
    `Cliente ${nombre} creado`,
    request.nextUrl.pathname
  );
});
