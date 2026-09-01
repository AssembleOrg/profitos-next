import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

// Responsables INTERNOS de una propiedad (usuarios de Profitos que reciben las
// notificaciones de consultas de cualquier portal). Independiente de ZonaProp.
// GET  → { assigned: [userId...], users: [{id, fullName, email}] }
// PUT  → body { userIds: string[] } (reemplaza el set completo)
export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const [assigned, users] = await Promise.all([
    prisma.propertyResponsible.findMany({ where: { propertyId: id }, select: { userId: true } }),
    prisma.user.findMany({
      select: { id: true, fullName: true, email: true },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
    }),
  ]);

  return ok({ assigned: assigned.map((a) => a.userId), users }, "Responsables obtenidos", path);
});

export const PUT = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const property = await prisma.property.findUnique({ where: { id }, select: { id: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  const body = (await request.json().catch(() => ({}))) as { userIds?: string[] };
  const userIds = [...new Set((body.userIds ?? []).filter((u) => typeof u === "string" && u))];

  await prisma.$transaction([
    prisma.propertyResponsible.deleteMany({ where: { propertyId: id, userId: { notIn: userIds } } }),
    ...userIds.map((userId) =>
      prisma.propertyResponsible.upsert({
        where: { propertyId_userId: { propertyId: id, userId } },
        create: { propertyId: id, userId },
        update: {},
      })
    ),
  ]);

  return ok({ assigned: userIds }, "Responsables actualizados", path);
});
