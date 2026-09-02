import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth } from "@/lib/api/chat-tools";
import { zonapropCreditsAlert } from "@/lib/publish/credits-alert";

// Tool del chat IA: estado de portales — conexiones, cupo ZonaProp (con
// alerta por umbral) y publicaciones por portal (solo lectura).
export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);

  const [sessions, mlToken, credits, pubs] = await Promise.all([
    prisma.scraperSession.findMany({ select: { portal: true, valid: true, lastOkAt: true } }),
    prisma.portalToken.findUnique({ where: { portal: "mercadolibre" }, select: { externalUser: true, expiresAt: true } }),
    zonapropCreditsAlert(),
    prisma.propertyPublication.groupBy({ by: ["portal", "status"], _count: true }),
  ]);

  const conexiones = [
    ...sessions.map((s) => ({ portal: s.portal, conectado: s.valid, ultimoOk: s.lastOkAt })),
    { portal: "mercadolibre", conectado: Boolean(mlToken), ultimoOk: mlToken?.expiresAt ?? null },
  ];

  const publicaciones: Record<string, Record<string, number>> = {};
  for (const p of pubs) {
    publicaciones[p.portal] = publicaciones[p.portal] ?? {};
    publicaciones[p.portal][p.status] = p._count;
  }

  return ok(
    {
      conexiones,
      cupoZonaprop: {
        planes: credits.planes,
        actualizado: credits.actualizado,
        error: credits.error,
        umbralAlerta: credits.umbral,
        alerta: credits.enAlerta.length
          ? `CUPO BAJO: ${credits.enAlerta.map((a) => `${a.plan} ${a.disponibles}${a.total != null ? `/${a.total}` : ""}`).join(", ")} (umbral ${credits.umbral}). Avisarle al usuario.`
          : null,
      },
      publicaciones,
    },
    "Estado de portales",
    request.nextUrl.pathname
  );
});
