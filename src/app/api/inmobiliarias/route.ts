import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Lista inmobiliarias (otras agencias). Pensado para el buscador con debounce
 * del form de movimientos y para el CRUD.
 * Query: ?q=texto (nombre/dirección/teléfono), ?limit=8
 */
export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const limit = Math.min(50, Math.max(1, Number.parseInt(sp.get("limit") ?? "20", 10) || 20));

  const where: Prisma.AgencyWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const items = await prisma.agency.findMany({
    where,
    orderBy: [{ name: "asc" }],
    take: limit,
    select: { id: true, name: true, address: true, phone: true },
  });

  return ok(items, "Inmobiliarias obtenidas correctamente", path);
});

/**
 * Crea una inmobiliaria. Solo el nombre es obligatorio.
 * Body: { name, address?, phone? }
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const body = (await request.json()) as { name?: string; address?: string | null; phone?: string | null };

  const name = body.name?.trim();
  if (!name) throw new AppError(400, "El nombre es obligatorio");

  const duplicate = await prisma.agency.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw new AppError(409, "Ya existe una inmobiliaria con ese nombre");

  const agency = await prisma.agency.create({
    data: {
      name,
      address: body.address?.trim() || null,
      phone: body.phone?.trim() || null,
    },
  });

  return created(agency, "Inmobiliaria creada correctamente", path);
});
