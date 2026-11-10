import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { assertChatToolsAuth, siteUrl } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";
import { getOwnerReportStats } from "@/lib/reports/owner-stats";

// Tools del chat IA para FICHAS de propiedad (PDF). El PDF lo genera la ruta
// existente /api/propiedades/[id]/pdf (sesión del usuario): acá sólo se
// resuelve la propiedad, se guardan los comentarios y se devuelve el link.
//  - GET: links de la ficha normal y de la ficha para el dueño.
//  - POST: guarda los comentarios de la ficha para el dueño (quejas, mejoras) y
//    devuelve el link. Requiere confirmación del lado del chat.
// Las visitas y consultas YA NO se cargan a mano: el informe las trae solo de
// ZonaProp y de la central (visitasTotales/visitasMes se ignoran si llegan).

type Body = {
  propertyId?: string;
  referencia?: string;
  direccion?: string;
  visitasTotales?: string | number;
  visitasMes?: string | number;
  quejas?: string;
  mejoras?: string;
};

function links(id: string) {
  const base = `${siteUrl()}/api/propiedades/${id}/pdf`;
  return { fichaUrl: base, fichaDuenoUrl: `${base}?mode=owner` };
}

export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const prop = await resolveProperty({
    propertyId: sp.get("propertyId") ?? undefined,
    referencia: sp.get("referencia") ?? undefined,
    direccion: sp.get("direccion") ?? undefined,
  });
  const row = await prisma.property.findUnique({ where: { id: prop.id }, select: { ownerReportData: true, referenceCode: true } });
  const stats = await getOwnerReportStats(prop.id, row?.referenceCode ?? null);
  const z = stats.zonaprop;
  return ok(
    {
      propiedad: prop,
      ...links(prop.id),
      comentariosActuales: (row?.ownerReportData as Record<string, unknown> | null) ?? null,
      zonaprop: z?.fetchedAt
        ? {
            datosAl: z.fetchedAt,
            ultimos30Dias: { apariciones: z.impressions30, visitas: z.visits30, consultas: z.contacts30 },
            visitasEsteMes: z.thisMonth.views,
            desdeQueSePublico: { visitas: z.totalVisits, interesados: z.totalLeads },
            promedioAvisosParecidos: z.segment,
          }
        : null,
      consultasEnProfitos: stats.inquiries,
      nota: "Compartí el link completo tal cual; se abre desde Profitos con la sesión del usuario.",
    },
    "Ficha de propiedad",
    request.nextUrl.pathname
  );
});

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const body = (await request.json().catch(() => ({}))) as Body;
  const prop = await resolveProperty(body);

  const clean = (v: unknown, max: number) => {
    const s = v == null ? "" : String(v).trim();
    return s ? s.slice(0, max) : undefined;
  };
  const nuevos: Record<string, string> = {};
  const q = clean(body.quejas, 1200);
  const m = clean(body.mejoras, 1200);
  if (q) nuevos.quejas = q;
  if (m) nuevos.mejoras = m;
  if (!Object.keys(nuevos).length) {
    throw new AppError(
      400,
      "No hay comentarios para guardar (quejas o mejoras). Las visitas ya no se cargan a mano: el informe las trae solo de ZonaProp."
    );
  }

  const row = await prisma.property.findUnique({ where: { id: prop.id }, select: { ownerReportData: true } });
  const prev = (row?.ownerReportData as Record<string, unknown> | null) ?? {};
  const merged = { ...prev, ...nuevos };
  await prisma.property.update({ where: { id: prop.id }, data: { ownerReportData: merged as Prisma.InputJsonValue } });

  return ok(
    { propiedad: prop, comentarios: merged, ...links(prop.id) },
    `Comentarios guardados para ${prop.direccion}. Ficha para el dueño lista.`,
    request.nextUrl.pathname
  );
});
