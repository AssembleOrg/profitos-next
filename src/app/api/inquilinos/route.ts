import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();

  const where: Prisma.TenantWhereInput = {};
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { idNumber: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: { _count: { select: { contracts: true } } },
      orderBy: [{ fullName: "asc" }],
      skip: paginationToSkip(page, limit),
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  return paginated(buildPaginatedResult(items, total, page, limit), "Inquilinos obtenidos correctamente", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const body = await request.json();
  const {
    fullName,
    idType,
    idNumber,
    phone,
    email,
    notes,
  } = body as {
    fullName?: string;
    idType?: string;
    idNumber?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };

  if (!fullName?.trim()) throw new AppError(400, "El nombre completo es obligatorio");
  if (idType !== "dni" && idType !== "cuit") throw new AppError(400, "Tipo de documento inválido");
  if (!idNumber?.trim()) throw new AppError(400, "El número de documento es obligatorio");

  const tenant = await prisma.tenant.create({
    data: {
      fullName: fullName.trim(),
      idType,
      idNumber: idNumber.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      notes: notes?.trim() || null,
    },
  });

  return created(tenant, "Inquilino creado correctamente", path);
});
