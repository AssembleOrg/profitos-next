import { NextResponse } from "next/server";
import type { ApiResponse, PaginatedResult, PaginationMeta } from "./types";

/**
 * Build a standard API response object.
 */
function buildResponse<T>(
  statusCode: number,
  data: T,
  message: string,
  path: string,
  meta: PaginationMeta | null = null
): ApiResponse<T> {
  return { statusCode, data, message, path, meta };
}

/**
 * Success response for a single resource.
 */
export function ok<T>(data: T, message: string, path: string) {
  const body = buildResponse(200, data, message, path);
  return NextResponse.json(body, { status: 200 });
}

/**
 * Success response for a created resource.
 */
export function created<T>(data: T, message: string, path: string) {
  const body = buildResponse(201, data, message, path);
  return NextResponse.json(body, { status: 201 });
}

/**
 * Success response for a paginated collection.
 */
export function paginated<T>(
  result: PaginatedResult<T>,
  message: string,
  path: string
) {
  const body = buildResponse(200, result.items, message, path, result.meta);
  return NextResponse.json(body, { status: 200 });
}

/**
 * Error response.
 */
export function error(
  statusCode: number,
  message: string,
  path: string
) {
  const body = buildResponse(statusCode, null, message, path);
  return NextResponse.json(body, { status: statusCode });
}

/**
 * Common error shortcuts.
 */
export function badRequest(message: string, path: string) {
  return error(400, message, path);
}

export function unauthorized(message: string, path: string) {
  return error(401, message, path);
}

export function forbidden(message: string, path: string) {
  return error(403, message, path);
}

export function notFound(message: string, path: string) {
  return error(404, message, path);
}

export function internalError(path: string) {
  return error(500, "Internal server error", path);
}
