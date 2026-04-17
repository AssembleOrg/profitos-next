import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));

  const where = {
    ...(isAdmin ? {} : { userId }),
    ...(q && {
      OR: [
        { titulo: { contains: q, mode: "insensitive" as const } },
        { direccion: { contains: q, mode: "insensitive" as const } },
      ],
    }),
    ...(status && { status }),
  };

  const [items, total] = await Promise.all([
    prisma.tasacion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { fullName: true, email: true } },
        property: { select: { address: true } },
      },
    }),
    prisma.tasacion.count({ where }),
  ]);

  return paginated(
    { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    "Tasaciones obtenidas",
    path
  );
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { userId } = await getAuthContext();
  const body = await request.json();

  const { titulo, direccion, propertyId } = body as {
    titulo?: string;
    direccion?: string;
    propertyId?: string;
  };

  if (!direccion?.trim()) throw new AppError(400, "La dirección es obligatoria");

  const tasacion = await prisma.tasacion.create({
    data: {
      titulo: titulo?.trim() || direccion.trim(),
      direccion: direccion.trim(),
      listaPreciosTitulo: `Lista de Precios - ${direccion.trim()}`,
      userId,
      propertyId: propertyId || null,
    },
  });

  return created(tasacion, "Tasación creada", path);
});
