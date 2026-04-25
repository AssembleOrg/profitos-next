import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { isSignatureStatus } from "@/lib/signatures";
import type { Prisma } from "@/generated/prisma/client";
import { FirmasClient } from "./_components/firmas-client";
import { serializeProposal } from "./_components/serialize";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    status?: string;
    propertyId?: string;
  }>;
}

export default async function FirmasPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE),
  );
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status?.trim() ?? "";
  const propertyId = sp.propertyId?.trim() ?? "";

  const where: Prisma.SignatureProposalWhereInput = {};
  if (statusFilter && isSignatureStatus(statusFilter)) where.status = statusFilter;
  if (propertyId) where.propertyId = propertyId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
    ];
  }

  const include = {
    property: {
      select: {
        id: true,
        address: true,
        city: true,
        zone: true,
        type: true,
        status: true,
        operationType: true,
        coverImageUrl: true,
        photos: true,
      },
    },
    createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    actions: {
      orderBy: [{ createdAt: "desc" }],
      include: {
        createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
      },
    },
  } satisfies Prisma.SignatureProposalInclude;

  const [items, total, kpiBuckets, properties] = await Promise.all([
    prisma.signatureProposal.findMany({
      where,
      include,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.signatureProposal.count({ where }),
    prisma.signatureProposal.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.property.findMany({
      select: { id: true, address: true, city: true, zone: true, operationType: true },
      orderBy: [{ address: "asc" }],
      take: 500,
    }),
  ]);

  const serialized = items.map(serializeProposal);

  let kpiTotal = 0;
  let kpiInProgress = 0;
  let kpiSuccessful = 0;
  let kpiRejected = 0;
  for (const bucket of kpiBuckets) {
    const count = bucket._count?._all ?? 0;
    kpiTotal += count;
    if (bucket.status === "propuesta_rechazada") kpiRejected += count;
    else if (bucket.status === "entrega_llaves") kpiSuccessful += count;
    else kpiInProgress += count;
  }

  return (
    <FirmasClient
      initialFirmas={serialized}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      total={total}
      limit={limit}
      isAdmin={user.role === "admin"}
      currentUserId={user.id}
      properties={properties}
      filters={{ q, status: statusFilter, propertyId }}
      kpis={{
        total: kpiTotal,
        inProgress: kpiInProgress,
        successful: kpiSuccessful,
        rejected: kpiRejected,
      }}
    />
  );
}
