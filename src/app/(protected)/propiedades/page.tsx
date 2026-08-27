import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PropiedadesClient } from "./_components/propiedades-client";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    status?: string;
    operation?: string;
    type?: string;
    city?: string;
    currency?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}

export default async function PropiedadesPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));

  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim().toLowerCase();
  const operation = (sp.operation ?? "").trim().toLowerCase();
  const type = (sp.type ?? "").trim().toLowerCase();
  const city = (sp.city ?? "").trim();
  const currency = (sp.currency ?? "").trim().toUpperCase();
  const parseOptionalNumber = (value?: string): number | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const minPrice = parseOptionalNumber(sp.minPrice);
  const maxPrice = parseOptionalNumber(sp.maxPrice);
  const sort = (sp.sort ?? "created_desc").trim();

  const andFilters: Prisma.PropertyWhereInput[] = [];

  if (q) {
    andFilters.push({
      OR: [
        { address: { contains: q, mode: "insensitive" } },
        { publicationTitle: { contains: q, mode: "insensitive" } },
        { referenceCode: { contains: q, mode: "insensitive" } },
        { realAddress: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (status) andFilters.push({ status });
  if (operation) andFilters.push({ operationType: { contains: operation, mode: "insensitive" } });
  if (type) andFilters.push({ type: { contains: type, mode: "insensitive" } });
  if (city) andFilters.push({ city: { contains: city, mode: "insensitive" } });
  if (currency) andFilters.push({ operationCurrency: { equals: currency, mode: "insensitive" } });
  if (minPrice !== null) andFilters.push({ operationPrice: { gte: minPrice } });
  if (maxPrice !== null) andFilters.push({ operationPrice: { lte: maxPrice } });

  const where: Prisma.PropertyWhereInput = andFilters.length > 0 ? { AND: andFilters } : {};

  const orderBy: Prisma.PropertyOrderByWithRelationInput[] = (() => {
    if (sort === "price_asc") return [{ operationPrice: "asc" }, { createdAt: "desc" }];
    if (sort === "price_desc") return [{ operationPrice: "desc" }, { createdAt: "desc" }];
    if (sort === "surface_desc") return [{ totalSurface: "desc" }, { createdAt: "desc" }];
    if (sort === "tokko_newest") return [{ tokkoCreatedAt: "desc" }, { createdAt: "desc" }];
    return [{ createdAt: "desc" }];
  })();

  const [properties, total, totalAll, usersForAssignments, propertiesForAssignments] = await Promise.all([
    prisma.property.findMany({
      where,
      include: {
        _count: { select: { visitas: true } },
        publications: {
          where: { portal: "mercadolibre" },
          select: { status: true, permalink: true, externalId: true },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.property.count({ where }),
    prisma.property.count(),
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
    geoLat: number | null;
    geoLong: number | null;
    ownerReportData: unknown;
    createdAt: Date;
    _count: { visitas: number };
    publications: { status: string; permalink: string | null; externalId: string | null }[];
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
    geoLat: p.geoLat,
    geoLong: p.geoLong,
    ownerReportData: (p.ownerReportData as Record<string, unknown>) ?? null,
    createdAt: p.createdAt.toISOString(),
    _count: p._count,
    mlPublication: p.publications[0]
      ? {
          status: p.publications[0].status,
          permalink: p.publications[0].permalink,
          published: Boolean(p.publications[0].externalId),
        }
      : null,
  }));

  return (
    <PropiedadesClient
      properties={serialized}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
      totalAll={totalAll}
      isAdmin={user.role === "admin"}
      usersForAssignments={usersForAssignments}
      propertiesForAssignments={propertiesForAssignments}
      filters={{
        q,
        status,
        operation,
        type,
        city,
        currency,
        sort,
      }}
    />
  );
}
