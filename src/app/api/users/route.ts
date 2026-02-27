import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";

/**
 * GET /api/users — Paginated list of users.
 *
 * Query params: ?page=1&limit=10
 *
 * Success response example:
 * {
 *   "statusCode": 200,
 *   "data": [{ "id": "abc", "email": "john@example.com", ... }],
 *   "message": "Usuarios obtenidos correctamente",
 *   "path": "/api/users",
 *   "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
 * }
 */
export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { page, limit } = parsePagination(request.nextUrl.searchParams);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: paginationToSkip(page, limit),
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
  ]);

  const result = buildPaginatedResult(users, total, page, limit);
  return paginated(result, "Usuarios obtenidos correctamente", path);
});

/**
 * POST /api/users — Create a new user.
 *
 * Body: { "id": "supabase-uid", "email": "john@example.com", "fullName": "John Doe" }
 *
 * Success response (201):
 * {
 *   "statusCode": 201,
 *   "data": { "id": "supabase-uid", "email": "john@example.com", ... },
 *   "message": "Usuario creado correctamente",
 *   "path": "/api/users",
 *   "meta": null
 * }
 *
 * Error response (400):
 * {
 *   "statusCode": 400,
 *   "data": null,
 *   "message": "El campo 'email' es obligatorio",
 *   "path": "/api/users",
 *   "meta": null
 * }
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const body = await request.json();

  const { id, email, fullName } = body as {
    id?: string;
    email?: string;
    fullName?: string;
  };

  if (!id) throw new AppError(400, "El campo 'id' es obligatorio");
  if (!email) throw new AppError(400, "El campo 'email' es obligatorio");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(400, "Ya existe un usuario con ese email");

  const user = await prisma.user.create({
    data: {
      id,
      email,
      fullName: fullName ?? null,
      role: "user",
    },
  });

  return created(user, "Usuario creado correctamente", path);
});
