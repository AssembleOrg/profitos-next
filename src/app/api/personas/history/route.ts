import { withHandler } from "@/lib/api/handler";
import { paginated } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";

export const runtime = "nodejs";

/**
 * Historial de consultas de personas hechas desde Profitos (compartido en la
 * inmobiliaria), más nuevas primero, con quién la hizo. Paginado.
 */
export const GET = withHandler(async (request) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const [rows, total] = await Promise.all([
    prisma.buscalaConsulta.findMany({
      orderBy: { createdAt: "desc" },
      skip: paginationToSkip(page, limit),
      take: limit,
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.buscalaConsulta.count(),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    identifier: r.identifier,
    kind: r.kind,
    buscalaReportId: r.buscalaReportId,
    label: r.label,
    createdAt: r.createdAt.toISOString(),
    author: r.user?.fullName ?? r.user?.email ?? null,
  }));
  return paginated(buildPaginatedResult(items, total, page, limit), "Historial", path);
});
