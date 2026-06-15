import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
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

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));

  const where = {
    ...(q && {
      OR: [
        { address: { contains: q, mode: "insensitive" as const } },
        { publicationTitle: { contains: q, mode: "insensitive" as const } },
        { referenceCode: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } },
        { zone: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { _count: { select: { visitas: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.property.count({ where }),
  ]);

  return paginated(
    { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    "Propiedades obtenidas correctamente",
    path
  );
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { userId } = await getAuthContext();
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

  if (!address) throw new AppError(400, "El campo 'address' es obligatorio");

  const property = await prisma.property.create({
    data: {
      address,
      source: "manual",
      realAddress: realAddress ?? null,
      publicationTitle: publicationTitle ?? null,
      referenceCode: referenceCode ?? null,
      publicUrl: publicUrl ?? null,
      city: city ?? null,
      zone: zone ?? null,
      type: type ?? null,
      status: status ?? "activa",
      roomAmount: numberOrNull(roomAmount),
      bathroomAmount: numberOrNull(bathroomAmount),
      totalSurface: numberOrNull(totalSurface),
      operationType: operationType ?? null,
      operationPrice: numberOrNull(operationPrice),
      operationCurrency: operationCurrency ?? null,
      userId: userId ?? null,
    },
  });

  return created(property, "Propiedad creada correctamente", path);
});
