import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PropiedadesClient } from "./_components/propiedades-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function PropiedadesPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = { userId: user.id };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { _count: { select: { visitas: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.property.count({ where }),
  ]);

  const serialized = properties.map((p) => ({
    id: p.id,
    address: p.address,
    city: p.city,
    zone: p.zone,
    type: p.type,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    _count: p._count,
  }));

  return (
    <PropiedadesClient
      properties={serialized}
      page={page}
      totalPages={Math.ceil(total / PAGE_SIZE)}
      total={total}
    />
  );
}
