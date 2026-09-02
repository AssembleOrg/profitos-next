import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";

// Tools del chat IA: TASACIONES.
//  - GET: lista/busca tasaciones (dirección, estado) con link a cada una.
//  - POST: inicia una tasación (borrador) para el usuario actual. Confirmación.
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const estado = (sp.get("estado") ?? "").trim();
  const limit = Math.min(30, Math.max(1, Number.parseInt(sp.get("limite") ?? "10", 10) || 10));

  const rows = await prisma.tasacion.findMany({
    where: {
      deletedAt: null,
      ...(estado ? { status: estado } : {}),
      ...(q ? { OR: [{ titulo: { contains: q, mode: "insensitive" } }, { direccion: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: {
      id: true,
      titulo: true,
      direccion: true,
      status: true,
      condicionVenta: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { fullName: true, email: true } },
      property: { select: { address: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  const porEstado = await prisma.tasacion.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true });

  return ok(
    {
      total: porEstado.reduce((a, s) => a + s._count, 0),
      porEstado: Object.fromEntries(porEstado.map((s) => [s.status, s._count])),
      tasaciones: rows.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        direccion: t.direccion,
        estado: t.status,
        condicionVenta: t.condicionVenta,
        responsable: t.user.fullName?.trim() || t.user.email,
        propiedadVinculada: t.property?.address ?? null,
        creada: t.createdAt.toISOString().slice(0, 10),
        url: `${siteUrl()}/tasaciones/${t.id}`,
      })),
    },
    "Tasaciones",
    request.nextUrl.pathname
  );
});

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as { direccion?: string; titulo?: string; propertyId?: string; referencia?: string };
  const direccion = (body.direccion ?? "").trim();
  if (!direccion) throw new AppError(400, "Falta la dirección a tasar");

  // Vincular a una propiedad nuestra sólo si la pidieron explícitamente por id/referencia.
  const prop = body.propertyId || body.referencia ? await resolveProperty({ propertyId: body.propertyId, referencia: body.referencia }) : null;

  const t = await prisma.tasacion.create({
    data: {
      titulo: body.titulo?.trim() || direccion,
      direccion,
      listaPreciosTitulo: `Lista de Precios - ${direccion}`,
      userId: who.userId,
      propertyId: prop?.id ?? null,
    },
    select: { id: true, titulo: true },
  });
  return created(
    { id: t.id, titulo: t.titulo, direccion, propiedadVinculada: prop?.direccion ?? null, url: `${siteUrl()}/tasaciones/${t.id}` },
    `Tasación "${t.titulo}" iniciada (borrador). Se completa desde la web.`,
    request.nextUrl.pathname
  );
});
