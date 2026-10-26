import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { startReport, BuscalaError } from "@/lib/buscala/client";

export const runtime = "nodejs";

/**
 * Inicia un informe de persona (Buscala). La API key vive sólo en el server
 * (este handler); el browser nunca la ve. Devuelve el informe recién creado
 * (fuentes en curso); el cliente poolea GET /api/personas/[id]. Deja el rastro
 * en el historial local (quién consultó qué).
 */
export const POST = withHandler(async (request) => {
  const path = request.nextUrl.pathname;
  const { userId } = await getAuthContext(); // exige estar logueado (staff)
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier) throw new AppError(400, "Ingresá un CUIT/CUIL o DNI.");
  try {
    const report = await startReport(identifier);
    // Historial local (best-effort: no bloquea la respuesta si falla).
    await prisma.buscalaConsulta
      .create({ data: { userId, identifier: report.identifier, kind: report.kind, buscalaReportId: report.id, label: report.label } })
      .catch((e) => console.error("[personas] no se pudo guardar el historial:", e));
    return created(report, "Informe iniciado", path);
  } catch (err) {
    throw toAppError(err);
  }
});

/** Traduce el error de Buscala a uno de Profitos (sin filtrar detalles del cupo). */
function toAppError(err: unknown): AppError {
  if (err instanceof BuscalaError) {
    if (err.status === 400) return new AppError(400, err.message);
    if (err.status === 422) return new AppError(422, "No se puede consultar a esta persona.");
    if (err.status === 401) return new AppError(502, "La integración con Buscala no está configurada correctamente.");
    // 503 (cupo oculto) y 5xx: mensaje genérico, sin mencionar límites.
    return new AppError(503, "El servicio de informes no está disponible por el momento. Probá de nuevo en unos minutos.");
  }
  return new AppError(502, "No se pudo conectar con el servicio de informes.");
}
