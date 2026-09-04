import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth";
import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { now } from "@/lib/datetime";
import { buildPortfolioReportPdf } from "@/lib/reports/portfolio-pdf";

/**
 * Reporte de portafolio en PDF: todas las propiedades (según los filtros de la
 * vista /propiedades) y en qué portal está publicada cada una, con su estado.
 * El botón "Exportar PDF" le pasa los mismos query params que la lista.
 */
export async function GET(request: NextRequest) {
  try {
    await getAuthContext(); // lanza 401 si no hay sesión

    const sp = request.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim();
    const status = (sp.get("status") ?? "").trim().toLowerCase();
    const operation = (sp.get("operation") ?? "").trim().toLowerCase();
    const type = (sp.get("type") ?? "").trim().toLowerCase();
    const city = (sp.get("city") ?? "").trim();
    const currency = (sp.get("currency") ?? "").trim().toUpperCase();
    const num = (v: string | null): number | null => {
      const t = (v ?? "").trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };
    const minPrice = num(sp.get("minPrice"));
    const maxPrice = num(sp.get("maxPrice"));
    const sort = (sp.get("sort") ?? "created_desc").trim();

    // ── mismo where que la lista de /propiedades ──
    const andFilters: Prisma.PropertyWhereInput[] = [];
    if (q) {
      andFilters.push({
        OR: [
          { address: { contains: q, mode: "insensitive" } },
          { publicationTitle: { contains: q, mode: "insensitive" } },
          { referenceCode: { contains: q, mode: "insensitive" } },
          { realAddress: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (status) andFilters.push({ status });
    if (operation) andFilters.push({ operationType: { contains: operation, mode: "insensitive" } });
    if (type) andFilters.push({ type: { contains: type, mode: "insensitive" } });
    if (city) andFilters.push({ city: { contains: city, mode: "insensitive" } });
    if (currency) andFilters.push({ operationCurrency: { equals: currency, mode: "insensitive" } });
    if (minPrice !== null) andFilters.push({ operationPrice: { gte: minPrice } });
    if (maxPrice !== null) andFilters.push({ operationPrice: { lte: maxPrice } });
    const where: Prisma.PropertyWhereInput = andFilters.length > 0 ? { AND: andFilters } : {};

    const orderBy: Prisma.PropertyOrderByWithRelationInput[] = (() => {
      if (sort === "price_asc") return [{ operationPrice: "asc" }, { address: "asc" }];
      if (sort === "price_desc") return [{ operationPrice: "desc" }, { address: "asc" }];
      if (sort === "surface_desc") return [{ totalSurface: "desc" }, { address: "asc" }];
      return [{ address: "asc" }];
    })();

    const props = await prisma.property.findMany({
      where,
      orderBy,
      take: 1000,
      select: {
        address: true,
        realAddress: true,
        referenceCode: true,
        city: true,
        zone: true,
        province: true,
        type: true,
        status: true,
        operationType: true,
        operationPrice: true,
        operationCurrency: true,
        publications: { select: { portal: true, status: true, externalId: true, permalink: true } },
      },
    });

    const bytes = await buildPortfolioReportPdf(props, { q, status, operation, type, city, currency, minPrice, maxPrice });
    const fileName = `portafolio_${now().toFormat("dd-MM-yyyy")}.pdf`;
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    console.error("[Portafolio PDF Error]", err);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  }
}
