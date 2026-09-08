import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { InmobiliariasClient } from "./_components/inmobiliarias-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; limit?: string; q?: string }>;
}

export default async function InmobiliariasPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = sp.q?.trim() ?? "";

  const where: Prisma.AgencyWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.agency.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.agency.count({ where }),
  ]);

  return (
    <InmobiliariasClient
      initialAgencies={items.map((a) => ({
        id: a.id,
        name: a.name,
        address: a.address,
        phone: a.phone,
        entriesCount: a._count.entries,
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
