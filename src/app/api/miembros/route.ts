import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) throw new AppError(403, "Solo administradores pueden ver miembros");

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));

  const where = {
    ...(q && {
      email: { contains: q, mode: "insensitive" as const },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.whitelist.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.whitelist.count({ where }),
  ]);

  return paginated(
    { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    "Miembros obtenidos correctamente",
    path
  );
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) throw new AppError(403, "Solo administradores pueden agregar miembros");

  const body = await request.json();
  const { email, role } = body as { email?: string; role?: string };

  if (!email?.trim()) throw new AppError(400, "El email es obligatorio");

  const normalized = email.trim().toLowerCase();
  const validRoles = ["admin", "user", "viewer"];
  const defaultRole = role && validRoles.includes(role) ? role : "user";

  const existing = await prisma.whitelist.findUnique({ where: { email: normalized } });
  if (existing) throw new AppError(409, "Este email ya está registrado");

  const entry = await prisma.whitelist.create({
    data: { email: normalized, defaultRole },
  });

  return created(entry, "Miembro agregado correctamente", path);
});
