import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";

// Todas las publicaciones de una propiedad (ML + ZonaProp + ArgenProp) para la UI.
export const GET = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { propertyId } = (await context!.params) as { propertyId: string };

  const rows = await prisma.propertyPublication.findMany({
    where: { propertyId },
    select: { portal: true, status: true, externalId: true, permalink: true, lastError: true, publishedAt: true, updatedAt: true },
  });

  const publications = rows.map((r) => ({
    portal: r.portal,
    status: r.status,
    published: Boolean(r.externalId),
    externalId: r.externalId,
    permalink: r.permalink,
    lastError: r.lastError,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return ok({ publications }, "Publicaciones de la propiedad", request.nextUrl.pathname);
});
