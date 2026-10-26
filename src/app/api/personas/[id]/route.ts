import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getReport, BuscalaError } from "@/lib/buscala/client";

export const runtime = "nodejs";

/** Estado/resultado de un informe en curso (polling). La key vive en el server. */
export const GET = withHandler(async (request, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = (await context!.params) as { id: string };
  try {
    const report = await getReport(id);
    return ok(report, "Informe", path);
  } catch (err) {
    if (err instanceof BuscalaError && err.status === 404) throw new AppError(404, "Informe no encontrado.");
    if (err instanceof BuscalaError) throw new AppError(502, "No se pudo leer el informe.");
    throw new AppError(502, "No se pudo conectar con el servicio de informes.");
  }
});
