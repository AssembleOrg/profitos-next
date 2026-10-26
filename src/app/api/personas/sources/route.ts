import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getSources } from "@/lib/buscala/client";

export const runtime = "nodejs";

/** Catálogo de fuentes (para mostrar nombres lindos en la UI). */
export const GET = withHandler(async (request) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const sources = await getSources();
  return ok(sources, "Fuentes", path);
});
