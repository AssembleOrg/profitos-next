import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getCollectContext } from "@/lib/rentals/views";

/** Contexto para la hoja de cobro: conceptos sugeridos, honorarios y próximos números. */
export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;
  const data = await getCollectContext(id);
  if (!data) throw new AppError(404, "Vencimiento no encontrado");
  return ok(data, "Cobro preparado", path);
});
