import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { parseOwnerBody } from "@/lib/rentals/owners";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const where: Prisma.OwnerWhereInput = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { idNumber: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const owners = await prisma.owner.findMany({
    where,
    orderBy: { fullName: "asc" },
    take: 500,
    include: { _count: { select: { contracts: true } } },
  });
  return ok(owners, "Propietarios", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const data = parseOwnerBody((await request.json()) as Record<string, unknown>);
  const owner = await prisma.owner.create({ data: { fullName: data.fullName!, ...data } });
  return created(owner, "Propietario creado", path);
});
