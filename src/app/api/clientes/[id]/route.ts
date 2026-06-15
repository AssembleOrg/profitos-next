import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const { id } = await context!.params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || (!isAdmin && client.userId !== userId)) throw new AppError(404, "Cliente no encontrado");

  return ok(client, "Cliente obtenido correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const { id } = await context!.params;

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing || (!isAdmin && existing.userId !== userId)) throw new AppError(404, "Cliente no encontrado");

  const body = await request.json();
  const { name, phone, email, notes } = body as Record<string, string | undefined>;
  const attachments = (body as { attachments?: unknown[] }).attachments;

  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(notes !== undefined && { notes }),
      ...(Array.isArray(attachments) && { attachments: attachments as never }),
    },
  });

  return ok(client, "Cliente actualizado correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const { id } = await context!.params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || (!isAdmin && client.userId !== userId)) throw new AppError(404, "Cliente no encontrado");

  await prisma.client.delete({ where: { id } });

  return ok(null, "Cliente eliminado correctamente", path);
});
