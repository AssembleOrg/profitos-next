import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth } from "@/lib/api/chat-tools";

// Tool del chat IA: busca propiedades (solo lectura, respuesta compacta).
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = (sp.get("estado") ?? "").trim().toLowerCase();
  const operation = (sp.get("operacion") ?? "").trim().toLowerCase();
  const type = (sp.get("tipo") ?? "").trim().toLowerCase();
  const limit = Math.min(25, Math.max(1, Number.parseInt(sp.get("limite") ?? "10", 10) || 10));

  const and: object[] = [];
  if (q)
    and.push({
      OR: [
        { address: { contains: q, mode: "insensitive" } },
        { realAddress: { contains: q, mode: "insensitive" } },
        { publicationTitle: { contains: q, mode: "insensitive" } },
        { referenceCode: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { zone: { contains: q, mode: "insensitive" } },
      ],
    });
  if (status) and.push({ status });
  if (operation) and.push({ operationType: { contains: operation, mode: "insensitive" } });
  if (type) and.push({ type: { contains: type, mode: "insensitive" } });

  const [total, rows] = await Promise.all([
    prisma.property.count({ where: { AND: and } }),
    prisma.property.findMany({
      where: { AND: and },
      select: {
        id: true,
        address: true,
        realAddress: true,
        city: true,
        zone: true,
        type: true,
        status: true,
        operationType: true,
        operationPrice: true,
        operationCurrency: true,
        roomAmount: true,
        totalSurface: true,
        referenceCode: true,
        publications: { select: { portal: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const propiedades = rows.map((p) => ({
    id: p.id, // para las tools de acción (ficha, publicaciones, editar)
    direccion: p.realAddress ?? p.address,
    zona: [p.zone, p.city].filter(Boolean).join(", ") || null,
    tipo: p.type,
    estado: p.status,
    operacion: p.operationType,
    precio: p.operationPrice ? `${p.operationCurrency ?? ""} ${p.operationPrice.toLocaleString("es-AR")}`.trim() : null,
    ambientes: p.roomAmount,
    superficie: p.totalSurface,
    codigo: p.referenceCode,
    portales: p.publications.map((x) => `${x.portal}:${x.status}`).join(", ") || "sin publicar",
  }));

  return ok({ total, mostrando: propiedades.length, propiedades }, "Propiedades", request.nextUrl.pathname);
});
