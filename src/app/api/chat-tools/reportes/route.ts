import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { buildEmployeeReport, parseRange } from "@/lib/reports/employee-report";

// Tool del chat IA: REPORTE de desempeño de un empleado (KPIs + link al PDF).
// Query: email? (admin: cualquiera; empleado: sólo el suyo), desde, hasta (YYYY-MM-DD).
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const sp = request.nextUrl.searchParams;
  const desde = sp.get("desde")?.trim();
  const hasta = sp.get("hasta")?.trim();
  if (!desde || !hasta) throw new AppError(400, "Faltan las fechas: preguntale al usuario desde y hasta (YYYY-MM-DD)");

  let email = (sp.get("email") ?? "").trim().toLowerCase();
  if (!email) email = who.email.toLowerCase();
  if (!who.isAdmin && email !== who.email.toLowerCase()) {
    throw new AppError(403, `${who.fullName ?? who.email} no es admin: sólo puede pedir su propio reporte.`);
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!user) {
    const users = await prisma.user.findMany({ select: { email: true, fullName: true }, orderBy: { fullName: "asc" } });
    throw new AppError(404, `No hay usuario con email ${email}. Usuarios: ${users.map((u) => `${u.fullName ?? "?"} <${u.email}>`).join("; ")}`);
  }

  const { from, to } = parseRange(desde, hasta);
  const r = await buildEmployeeReport(user.id, from, to);
  const pdfUrl = `${siteUrl()}/api/reportes/empleado/pdf?email=${encodeURIComponent(email)}&from=${desde}&to=${hasta}`;

  return ok(
    {
      empleado: r.member.fullName ?? r.member.email,
      periodo: { desde, hasta, dias: r.range.dias },
      kpis: r.kpis,
      objetivos: r.objetivos.map((o) => ({ titulo: o.titulo, estado: o.estado, items: `${o.items.filter((i) => i.estado === "done").length}/${o.items.length}` })),
      pdfUrl,
      nota: "Compartí el link del PDF completo tal cual (se abre desde Profitos con la sesión del usuario) y resumí los KPIs principales en prosa.",
    },
    "Reporte de desempeño",
    request.nextUrl.pathname
  );
});
