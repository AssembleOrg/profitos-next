import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";

/**
 * GET /api/users/:id — Get a single user by ID.
 *
 * Success response (200):
 * {
 *   "statusCode": 200,
 *   "data": { "id": "abc", "email": "john@example.com", "fullName": "John Doe", ... },
 *   "message": "Usuario obtenido correctamente",
 *   "path": "/api/users/abc",
 *   "meta": null
 * }
 *
 * Error response (404):
 * {
 *   "statusCode": 404,
 *   "data": null,
 *   "message": "Usuario no encontrado",
 *   "path": "/api/users/abc",
 *   "meta": null
 * }
 */
export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const { id } = await context!.params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, "Usuario no encontrado");

  return ok(user, "Usuario obtenido correctamente", path);
});
