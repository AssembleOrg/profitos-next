import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/api/handler";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { buildEmployeeReport, parseRange } from "@/lib/reports/employee-report";
import { renderEmployeeReportPdf } from "@/lib/reports/employee-report-pdf";

// PDF del reporte de desempeño de un empleado.
// GET /api/reportes/empleado/pdf?email=<usuario>&from=YYYY-MM-DD&to=YYYY-MM-DD
// Permisos: admin → cualquiera; empleado → sólo el propio. Sin email = el propio.
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const sp = request.nextUrl.searchParams;
    const email = (sp.get("email") ?? ctx.email).trim().toLowerCase();
    if (!ctx.isAdmin && email !== ctx.email.toLowerCase()) throw new AppError(403, "Sólo podés ver tu propio reporte");

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (!user) throw new AppError(404, "Usuario no encontrado");

    const { from, to } = parseRange(sp.get("from"), sp.get("to"));
    const report = await buildEmployeeReport(user.id, from, to);
    const bytes = await renderEmployeeReportPdf(report);

    const slug = (report.member.fullName ?? report.member.email).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const name = `reporte-${slug}-${sp.get("from") ?? from.toISOString().slice(0, 10)}-${sp.get("to") ?? to.toISOString().slice(0, 10)}.pdf`;
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${name}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    const status = e instanceof AppError ? e.statusCode : 500;
    const message = e instanceof Error ? e.message : "Error generando el reporte";
    return NextResponse.json({ message }, { status });
  }
}
