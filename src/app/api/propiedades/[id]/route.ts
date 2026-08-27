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
    province,
    zone,
    type,
    status,
    roomAmount,
    bedrooms,
    bathroomAmount,
    parkingLotAmount,
    totalSurface,
    roofedSurface,
    operationType,
    operationPrice,
    operationCurrency,
    geoLat,
    geoLong,
  } = body as Record<string, string | undefined>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if (address !== undefined) data.address = address;
  if (realAddress !== undefined) data.realAddress = realAddress || null;
  if (publicationTitle !== undefined) data.publicationTitle = publicationTitle || null;
  if (referenceCode !== undefined) data.referenceCode = referenceCode || null;
  if (publicUrl !== undefined) data.publicUrl = publicUrl || null;
  if (city !== undefined) data.city = city;
  if (province !== undefined) data.province = province || null;
  if (zone !== undefined) data.zone = zone;
  if (type !== undefined) data.type = type;
  if (status !== undefined) data.status = status;
  if (roomAmount !== undefined) data.roomAmount = numberOrNull(roomAmount);
  if (bedrooms !== undefined) data.bedrooms = numberOrNull(bedrooms);
  if (bathroomAmount !== undefined) data.bathroomAmount = numberOrNull(bathroomAmount);
  if (parkingLotAmount !== undefined) data.parkingLotAmount = numberOrNull(parkingLotAmount);
  if (totalSurface !== undefined) data.totalSurface = numberOrNull(totalSurface);
  if (roofedSurface !== undefined) data.roofedSurface = numberOrNull(roofedSurface);
  if (operationType !== undefined) data.operationType = operationType || null;
  if (operationPrice !== undefined) data.operationPrice = numberOrNull(operationPrice);
  if (operationCurrency !== undefined) data.operationCurrency = operationCurrency || null;
  if (geoLat !== undefined) data.geoLat = numberOrNull(geoLat);
  if (geoLong !== undefined) data.geoLong = numberOrNull(geoLong);
  if ((body as Record<string, unknown>).ownerReportData !== undefined) {
    data.ownerReportData = (body as Record<string, unknown>).ownerReportData ?? null;
  }

  const property = await prisma.property.update({ where: { id }, data });

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
