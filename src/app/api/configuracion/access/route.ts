import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { GRANTABLE_VIEWS } from "@/lib/nav/views";

const GRANTABLE_HREFS = new Set(GRANTABLE_VIEWS.map((v) => v.href));

/**
 * Lista los miembros (whitelist) con sus vistas concedidas y datos del usuario
 * (nombre/avatar) si ya inició sesión. Solo admin.
 */
export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) throw new AppError(403, "Solo administradores pueden ver los accesos");

  const entries = await prisma.whitelist.findMany({ orderBy: { createdAt: "asc" } });
  const users = await prisma.user.findMany({ select: { email: true, fullName: true, avatarUrl: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  const members = entries.map((e) => {
    const user = userByEmail.get(e.email.toLowerCase());
    return {
      email: e.email,
      defaultRole: e.defaultRole,
      isActive: e.isActive,
      allowedViews: Array.isArray(e.allowedViews) ? (e.allowedViews as string[]) : null,
      fullName: user?.fullName ?? null,
      avatarUrl: user?.avatarUrl ?? null,
    };
  });

  return ok({ members }, "Accesos obtenidos correctamente", path);
});

/**
 * Actualiza las vistas concedidas a un email de la whitelist. Solo admin.
 * Body: { email: string, allowedViews: string[] }
 */
export const PATCH = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) throw new AppError(403, "Solo administradores pueden editar los accesos");

  const body = await request.json();
  const { email, allowedViews } = body as { email?: string; allowedViews?: unknown };

  if (!email?.trim()) throw new AppError(400, "Falta el email");
  if (!Array.isArray(allowedViews) || allowedViews.some((v) => typeof v !== "string")) {
    throw new AppError(400, "Vistas inválidas");
  }

  const normalized = email.trim().toLowerCase();
  const entry = await prisma.whitelist.findUnique({ where: { email: normalized } });
  if (!entry) throw new AppError(404, "El email no está en la whitelist");

  // Solo se guardan vistas concedibles (se descartan dashboard / admin-only / desconocidas).
  const clean = [...new Set((allowedViews as string[]).filter((href) => GRANTABLE_HREFS.has(href)))];

  await prisma.whitelist.update({
    where: { email: normalized },
    data: { allowedViews: clean },
  });

  return ok({ email: normalized, allowedViews: clean }, "Accesos actualizados", path);
});
