import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError(401, "No autenticado");
  return user.id;
}

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const { id } = await context!.params;

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || property.userId !== userId) throw new AppError(404, "Propiedad no encontrada");

  return ok(property, "Propiedad obtenida correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const { id } = await context!.params;

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) throw new AppError(404, "Propiedad no encontrada");

  const body = await request.json();
  const { address, city, zone, type, status } = body as Record<string, string | undefined>;

  const property = await prisma.property.update({
    where: { id },
    data: {
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(zone !== undefined && { zone }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
    },
  });

  return ok(property, "Propiedad actualizada correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const userId = await getAuthUserId();
  const { id } = await context!.params;

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || property.userId !== userId) throw new AppError(404, "Propiedad no encontrada");

  await prisma.property.delete({ where: { id } });

  return ok(null, "Propiedad eliminada correctamente", path);
});
