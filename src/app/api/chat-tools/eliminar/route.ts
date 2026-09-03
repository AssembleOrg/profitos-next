import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";

// Tool del chat IA: ELIMINAR registros (con confirmación del lado del chat).
// Mismos permisos que la web:
//  - propiedad: cualquier usuario. Si tiene avisos activos/pausados en
//    portales, se rechaza (409) salvo forzar=true (quedarían huérfanos).
//  - cliente: quien lo creó o admin.
//  - seguimiento: sólo admin.
//  - tasacion: quien la creó o admin (borrado lógico, como la web).
const TIPOS = ["propiedad", "cliente", "seguimiento", "tasacion"] as const;
type Tipo = (typeof TIPOS)[number];

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as {
    tipo?: string;
    id?: string;
    propertyId?: string;
    referencia?: string;
    direccion?: string;
    forzar?: boolean;
  };
  const tipo = (body.tipo ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") as Tipo;
  if (!TIPOS.includes(tipo)) throw new AppError(400, `Tipo inválido: "${body.tipo}" (${TIPOS.join(", ")})`);
  const path = request.nextUrl.pathname;
  const id = (body.id ?? "").trim();

  if (tipo === "propiedad") {
    const prop = await resolveProperty({ propertyId: body.propertyId || id || undefined, referencia: body.referencia, direccion: body.direccion });
    const pubs = await prisma.propertyPublication.findMany({
      where: { propertyId: prop.id, externalId: { not: null }, status: { in: ["active", "paused", "publishing"] } },
      select: { portal: true, status: true },
    });
    if (pubs.length && !body.forzar) {
      throw new AppError(
        409,
        `${prop.direccion} tiene avisos en ${pubs.map((p) => `${p.portal} (${p.status})`).join(", ")}. Dalos de baja primero con gestionar_publicacion, o si el usuario igual quiere borrarla reintentá con forzar=true (los avisos quedan huérfanos en los portales).`
      );
    }
    await prisma.property.delete({ where: { id: prop.id } });
    console.log(`[chat-tools] ${who.email} eliminó propiedad ${prop.id} (${prop.direccion})`);
    return ok({ tipo, eliminado: prop }, `Propiedad ${prop.direccion}${prop.codigo ? ` (${prop.codigo})` : ""} eliminada`, path);
  }

  if (!id) throw new AppError(400, `Falta id del ${tipo} (campo "id" de la tool de búsqueda correspondiente)`);

  if (tipo === "cliente") {
    const c = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true, userId: true } });
    if (!c) throw new AppError(404, "Cliente no encontrado");
    if (!who.isAdmin && c.userId !== who.userId) throw new AppError(403, "Sólo quien lo creó (o un admin) puede eliminar este cliente");
    await prisma.client.delete({ where: { id } });
    console.log(`[chat-tools] ${who.email} eliminó cliente ${id} (${c.name})`);
    return ok({ tipo, eliminado: { id, nombre: c.name } }, `Cliente ${c.name} eliminado`, path);
  }

  if (tipo === "seguimiento") {
    if (!who.isAdmin) throw new AppError(403, "Sólo un admin puede eliminar seguimientos (podés marcarlo como hecho con agregar_accion_seguimiento)");
    const f = await prisma.propertyFollowUp.findUnique({ where: { id }, select: { id: true, title: true, property: { select: { address: true } } } });
    if (!f) throw new AppError(404, "Seguimiento no encontrado");
    await prisma.propertyFollowUp.delete({ where: { id } });
    console.log(`[chat-tools] ${who.email} eliminó seguimiento ${id}`);
    return ok({ tipo, eliminado: { id, titulo: f.title, propiedad: f.property.address } }, `Seguimiento de ${f.property.address}${f.title ? ` ("${f.title}")` : ""} eliminado`, path);
  }

  const t = await prisma.tasacion.findUnique({ where: { id }, select: { id: true, titulo: true, userId: true, deletedAt: true } });
  if (!t || t.deletedAt) throw new AppError(404, "Tasación no encontrada");
  if (!who.isAdmin && t.userId !== who.userId) throw new AppError(403, "Sólo quien la creó (o un admin) puede eliminar esta tasación");
  await prisma.tasacion.update({ where: { id }, data: { deletedAt: new Date() } });
  console.log(`[chat-tools] ${who.email} eliminó tasación ${id}`);
  return ok({ tipo, eliminado: { id, titulo: t.titulo } }, `Tasación "${t.titulo}" eliminada`, path);
});
