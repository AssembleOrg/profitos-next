import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { assertChatToolsAuth, siteUrl } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";

// Tools del chat IA para FICHAS de propiedad (PDF). El PDF lo genera la ruta
// existente /api/propiedades/[id]/pdf (sesión del usuario): acá sólo se
// resuelve la propiedad, se guardan los comentarios y se devuelve el link.
//  - GET: links de la ficha normal y de la ficha para el dueño.
//  - POST: guarda los comentarios de la ficha para el dueño (visitas, quejas,
//    mejoras) y devuelve el link. Requiere confirmación del lado del chat.

type Body = {
  propertyId?: string;
  referencia?: string;
  direccion?: string;
  visitasTotales?: string | number;
  visitasMes?: string | number;
  quejas?: string;
  mejoras?: string;
};

function links(id: string) {
  const base = `${siteUrl()}/api/propiedades/${id}/pdf`;
  return { fichaUrl: base, fichaDuenoUrl: `${base}?mode=owner` };
}

export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const prop = await resolveProperty({
    propertyId: sp.get("propertyId") ?? undefined,
    referencia: sp.get("referencia") ?? undefined,
    direccion: sp.get("direccion") ?? undefined,
  });
  const row = await prisma.property.findUnique({ where: { id: prop.id }, select: { ownerReportData: true } });
  return ok(
    {
      propiedad: prop,
      ...links(prop.id),
      comentariosActuales: (row?.ownerReportData as Record<string, unknown> | null) ?? null,
      nota: "Compartí el link completo tal cual; se abre desde Profitos con la sesión del usuario.",
    },
    "Ficha de propiedad",
    request.nextUrl.pathname
  );
});

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const body = (await request.json().catch(() => ({}))) as Body;
  const prop = await resolveProperty(body);

  const clean = (v: unknown, max: number) => {
    const s = v == null ? "" : String(v).trim();
    return s ? s.slice(0, max) : undefined;
  };
  const nuevos: Record<string, string> = {};
  const vt = clean(body.visitasTotales, 40);
  const vm = clean(body.visitasMes, 40);
  const q = clean(body.quejas, 1200);
  const m = clean(body.mejoras, 1200);
  if (vt) nuevos.visitasTotales = vt;
  if (vm) nuevos.visitasMes = vm;
  if (q) nuevos.quejas = q;
  if (m) nuevos.mejoras = m;
  if (!Object.keys(nuevos).length) {
    throw new AppError(400, "No hay comentarios para guardar (visitasTotales, visitasMes, quejas o mejoras)");
  }

  const row = await prisma.property.findUnique({ where: { id: prop.id }, select: { ownerReportData: true } });
  const prev = (row?.ownerReportData as Record<string, unknown> | null) ?? {};
  const merged = { ...prev, ...nuevos };
  await prisma.property.update({ where: { id: prop.id }, data: { ownerReportData: merged as Prisma.InputJsonValue } });

  return ok(
    { propiedad: prop, comentarios: merged, ...links(prop.id) },
    `Comentarios guardados para ${prop.direccion}. Ficha para el dueño lista.`,
    request.nextUrl.pathname
  );
});
