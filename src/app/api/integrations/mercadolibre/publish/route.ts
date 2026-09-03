import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import type { MlPublishInput } from "@/lib/mercadolibre/items";
import { publishPropertyToMl } from "@/lib/mercadolibre/publish-property";

// Publica (o re-publica/edita) una propiedad en MercadoLibre.
// Body: { propertyId, input: MlPublishInput }
// La lógica vive en lib/mercadolibre/publish-property.ts (compartida con el chat IA).
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const body = (await request.json()) as { propertyId?: string; input?: MlPublishInput };
  if (!body.propertyId) throw new AppError(400, "Falta propertyId");
  if (!body.input) throw new AppError(400, "Falta input");

  const { publication, updated } = await publishPropertyToMl(body.propertyId, body.input);
  return ok(publication, updated ? "Publicación actualizada" : "Publicado en MercadoLibre", path);
});
