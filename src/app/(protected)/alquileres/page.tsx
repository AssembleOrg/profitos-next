import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { AlquileresClient } from "./_components/alquileres-client";
import { serializeContract } from "./_components/serialize";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    tab?: string;
  }>;
}

export default async function AlquileresPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = sp.q?.trim() ?? "";
  const tab = sp.tab === "cobros" ? "cobros" : "contratos";

  const where: Prisma.RentalContractWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
      { tenant: { fullName: { contains: q, mode: "insensitive" } } },
      { tenant: { idNumber: { contains: q } } },
    ];
  }

  const include = {
    property: { select: { id: true, address: true, city: true, zone: true, coverImageUrl: true } },
    tenant: { select: { id: true, fullName: true, idType: true, idNumber: true, phone: true, email: true } },
    createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
    additionals: {
      include: { additional: { select: { id: true, name: true, defaultAmount: true } } },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    },
    dueDates: {
      orderBy: [{ position: "asc" }, { dueDate: "asc" }],
      include: {
        additionals: {
          include: {
            contractAdditional: {
              include: { additional: { select: { id: true, name: true } } },
            },
          },
        },
        transactions: {
          orderBy: [{ paidAt: "desc" }],
          include: {
            createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
          },
        },
        actions: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            createdByUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    },
  } satisfies Prisma.RentalContractInclude;

  const [contracts, total, properties, tenants, additionals] = await Promise.all([
    prisma.rentalContract.findMany({
      where,
      include,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.rentalContract.count({ where }),
    prisma.property.findMany({
      select: { id: true, address: true, city: true, zone: true, coverImageUrl: true },
      orderBy: [{ address: "asc" }],
      take: 500,
    }),
    prisma.tenant.findMany({
      select: { id: true, fullName: true, idType: true, idNumber: true, phone: true, email: true },
      orderBy: [{ fullName: "asc" }],
      take: 500,
    }),
    prisma.rentalAdditional.findMany({
      select: { id: true, name: true, defaultAmount: true, notes: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const serialized = contracts.map(serializeContract);

  return (
    <AlquileresClient
      initialContracts={serialized}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      total={total}
      limit={limit}
      isAdmin={user.role === "admin"}
      currentUserId={user.id}
      properties={properties}
      tenants={tenants}
      additionalsCatalog={additionals}
      filterQ={q}
      tab={tab}
    />
  );
}
