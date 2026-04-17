import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const { id } = await context!.params;

  const tasacion = await prisma.tasacion.findUnique({
    where: { id },
    include: {
      user: { select: { fullName: true, email: true } },
      property: { select: { id: true, address: true } },
    },
  });

  if (!tasacion) throw new AppError(404, "Tasación no encontrada");
  if (!isAdmin && tasacion.userId !== userId) throw new AppError(404, "Tasación no encontrada");

  return ok(tasacion, "Tasación obtenida", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const { id } = await context!.params;

  const existing = await prisma.tasacion.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Tasación no encontrada");
  if (!isAdmin && existing.userId !== userId) throw new AppError(404, "Tasación no encontrada");

  const body = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  const stringFields = [
    "titulo", "direccion", "ubicacionUnidad", "superficieTotal",
    "superficieMono", "condicionVenta", "mapaImageUrl",
    "informeHtml", "resultadoHtml", "listaPreciosTitulo", "status",
  ] as const;

  for (const field of stringFields) {
    if (body[field] !== undefined) data[field] = body[field] ?? null;
  }

  if (body.fotos !== undefined) data.fotos = body.fotos;
  if (body.tablas !== undefined) data.tablas = body.tablas;
  if (body.propertyId !== undefined) data.propertyId = body.propertyId || null;

  const tasacion = await prisma.tasacion.update({ where: { id }, data });

  return ok(tasacion, "Tasación actualizada", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const { id } = await context!.params;

  const existing = await prisma.tasacion.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Tasación no encontrada");
  if (!isAdmin && existing.userId !== userId) throw new AppError(404, "Tasación no encontrada");

  await prisma.tasacion.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok(null, "Tasación eliminada", path);
});
