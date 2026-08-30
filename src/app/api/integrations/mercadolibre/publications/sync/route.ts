import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { syncMlPublications } from "@/lib/mercadolibre/sync";

// Refresca el estado real de todas las publicaciones ML contra la API y actualiza
// la DB. Botón manual; además el worker lo corre solo cada 2h (ver serve-worker).
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const { total, updated } = await syncMlPublications();
  return ok({ total, updated }, `${updated} publicaciones actualizadas`, request.nextUrl.pathname);
});
