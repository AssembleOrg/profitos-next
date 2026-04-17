import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

const VALID_ROLES = ["admin", "user", "viewer"] as const;

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) throw new AppError(403, "Solo administradores");

  const { id } = await context!.params;
  const existing = await prisma.whitelist.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Miembro no encontrado");

  const body = await request.json();
  const { isActive, role } = body as { isActive?: boolean; role?: string };

  // Update whitelist entry (active toggle)
  if (isActive !== undefined) {
    const updated = await prisma.whitelist.update({
      where: { id },
      data: { isActive },
    });
    return ok(updated, "Miembro actualizado correctamente", path);
  }

  // Update user role
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      throw new AppError(400, "Rol inválido");
    }

    // Always update the defaultRole in whitelist
    await prisma.whitelist.update({
      where: { id },
      data: { defaultRole: role },
    });

    // If the user already has an account, update their role too
    const user = await prisma.user.findFirst({
      where: { email: { equals: existing.email, mode: "insensitive" } },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    }

    return ok({ ...existing, role }, "Rol actualizado correctamente", path);
  }

  return ok(existing, "Sin cambios", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) throw new AppError(403, "Solo administradores");

  const { id } = await context!.params;
  const existing = await prisma.whitelist.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Miembro no encontrado");

  await prisma.whitelist.delete({ where: { id } });

  return ok(null, "Miembro eliminado correctamente", path);
});
