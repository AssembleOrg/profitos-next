import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  return ok(property, "Propiedad obtenida correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Propiedad no encontrada");

  const body = await request.json();
  const {
    address,
    realAddress,
    publicationTitle,
    referenceCode,
    publicUrl,
    city,
    zone,
    type,
    status,
    roomAmount,
    bathroomAmount,
    totalSurface,
    operationType,
    operationPrice,
    operationCurrency,
  } = body as Record<string, string | undefined>;

  const property = await prisma.property.update({
    where: { id },
    data: {
      ...(address !== undefined && { address }),
      ...(realAddress !== undefined && { realAddress: realAddress || null }),
      ...(publicationTitle !== undefined && { publicationTitle: publicationTitle || null }),
      ...(referenceCode !== undefined && { referenceCode: referenceCode || null }),
      ...(publicUrl !== undefined && { publicUrl: publicUrl || null }),
      ...(city !== undefined && { city }),
      ...(zone !== undefined && { zone }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
      ...(roomAmount !== undefined && { roomAmount: numberOrNull(roomAmount) }),
      ...(bathroomAmount !== undefined && { bathroomAmount: numberOrNull(bathroomAmount) }),
      ...(totalSurface !== undefined && { totalSurface: numberOrNull(totalSurface) }),
      ...(operationType !== undefined && { operationType: operationType || null }),
      ...(operationPrice !== undefined && { operationPrice: numberOrNull(operationPrice) }),
      ...(operationCurrency !== undefined && { operationCurrency: operationCurrency || null }),
    },
  });

  return ok(property, "Propiedad actualizada correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  await prisma.property.delete({ where: { id } });

  return ok(null, "Propiedad eliminada correctamente", path);
});
