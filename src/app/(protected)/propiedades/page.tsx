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

  const where = {};

  const [properties, total, usersForAssignments, propertiesForAssignments] = await Promise.all([
    prisma.property.findMany({
      where,
      include: { _count: { select: { visitas: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.property.count({ where }),
    user.role === "admin"
      ? prisma.user.findMany({
          select: { id: true, fullName: true, email: true },
          orderBy: [{ fullName: "asc" }, { email: "asc" }],
        })
      : Promise.resolve([]),
    user.role === "admin"
      ? prisma.property.findMany({
          select: { id: true, address: true },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
  ]);

  const serialized = properties.map((p: {
    id: string;
    tokkoId: number | null;
    source: string;
    address: string;
    realAddress: string | null;
    publicationTitle: string | null;
    referenceCode: string | null;
    publicUrl: string | null;
    city: string | null;
    zone: string | null;
    type: string | null;
    status: string;
    roomAmount: number | null;
    bathroomAmount: number | null;
    totalSurface: number | null;
    operationType: string | null;
    operationPrice: number | null;
    operationCurrency: string | null;
    createdAt: Date;
    _count: { visitas: number };
  }) => ({
    id: p.id,
    tokkoId: p.tokkoId,
    source: p.source,
    address: p.address,
    realAddress: p.realAddress,
    publicationTitle: p.publicationTitle,
    referenceCode: p.referenceCode,
    publicUrl: p.publicUrl,
    city: p.city,
    zone: p.zone,
    type: p.type,
    status: p.status,
    roomAmount: p.roomAmount,
    bathroomAmount: p.bathroomAmount,
    totalSurface: p.totalSurface,
    operationType: p.operationType,
    operationPrice: p.operationPrice,
    operationCurrency: p.operationCurrency,
    createdAt: p.createdAt.toISOString(),
    _count: p._count,
  }));

  return (
    <PropiedadesClient
      properties={serialized}
      page={page}
      totalPages={Math.ceil(total / PAGE_SIZE)}
      total={total}
      isAdmin={user.role === "admin"}
      usersForAssignments={usersForAssignments}
      propertiesForAssignments={propertiesForAssignments}
    />
  );
}
