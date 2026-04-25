import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { InquilinosClient } from "./_components/inquilinos-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; limit?: string; q?: string }>;
}

export default async function InquilinosPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = sp.q?.trim() ?? "";

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
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ]);

  return (
    <InquilinosClient
      initialTenants={items.map((t) => ({
        id: t.id,
        fullName: t.fullName,
        idType: t.idType,
        idNumber: t.idNumber,
        phone: t.phone,
        email: t.email,
        notes: t.notes,
        contractsCount: t._count.contracts,
        createdAt: t.createdAt.toISOString(),
      }))}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      total={total}
      limit={limit}
      isAdmin={user.role === "admin"}
      filterQ={q}
    />
  );
}
