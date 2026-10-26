import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";

export const runtime = "nodejs";

/**
 * Borra una entrada del historial local (no toca el informe en Buscala). La
 * puede borrar quien la hizo o un admin.
 */
export const DELETE = withHandler(async (request, context) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const { id } = (await context!.params) as { id: string };
  const row = await prisma.buscalaConsulta.findUnique({ where: { id }, select: { userId: true } });
  if (!row) throw new AppError(404, "No encontrado.");
  if (!isAdmin && row.userId !== userId) throw new AppError(403, "No podés borrar consultas de otra persona.");
  await prisma.buscalaConsulta.delete({ where: { id } });
  return ok({ ok: true }, "Eliminado", path);
});
