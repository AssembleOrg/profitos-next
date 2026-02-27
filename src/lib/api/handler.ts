import { NextResponse, type NextRequest } from "next/server";
import type { ApiResponse } from "./types";
import { internalError } from "./response";

/**
 * AppError — throw inside handlers for automatic formatting.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

type RouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<ApiResponse>>;

/**
 * Wraps a Route Handler with global error handling.
 * Acts as both interceptor (passes through success) and exception filter (catches errors).
 *
 * Usage:
 *   export const GET = withHandler(async (request) => {
 *     const user = await getUser(id);
 *     if (!user) throw new AppError(404, "Usuario no encontrado");
 *     return ok(user, "Usuario obtenido correctamente", request.nextUrl.pathname);
 *   });
 */
export function withHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const path = request.nextUrl.pathname;

    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof AppError) {
        const body: ApiResponse = {
          statusCode: err.statusCode,
          data: null,
          message: err.message,
          path,
          meta: null,
        };
        return NextResponse.json(body, { status: err.statusCode });
      }

      console.error(`[API Error] ${path}:`, err);
      return internalError(path);
    }
  };
}
