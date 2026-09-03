import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { SeguimientosClient } from "./_components/seguimientos-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; limit?: string; q?: string; status?: string; vencidos?: string }>;
}

export default async function SeguimientosPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";
  const where: Prisma.PropertyFollowUpWhereInput = user.role === "admin" ? {} : { assignedToUserId: user.id };
  if (status) where.status = status;
  // Deep-link desde el dashboard: misma definición que el KPI "vencidos" del API.
  if (sp.vencidos === "1") {
    where.status = { notIn: ["hecho", "cancelado"] };
    where.dueDate = { lt: new Date() };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
      { assignedToUser: { fullName: { contains: q, mode: "insensitive" } } },
      { assignedToUser: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [followUps, total, users, properties] = await Promise.all([
    prisma.propertyFollowUp.findMany({
      where,
      include: {
        property: {
          select: { id: true, address: true, city: true, zone: true },
        },
        assignedToUser: {
          select: { id: true, email: true, fullName: true },
        },
        assignedByUser: {
          select: { id: true, email: true, fullName: true },
        },
        _count: {
          select: { actions: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.propertyFollowUp.count({ where }),
    user.role === "admin"
      ? prisma.user.findMany({
          select: { id: true, fullName: true, email: true },
          orderBy: [{ fullName: "asc" }, { email: "asc" }],
        })
      : Promise.resolve([]),
    user.role === "admin"
      ? prisma.property.findMany({
          select: { id: true, address: true, city: true, zone: true },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
  ]);

  const serializedFollowUps = followUps.map((item) => ({
    id: item.id,
    title: item.title,
    notes: item.notes,
    status: item.status,
    dueDate: item.dueDate?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    property: item.property,
    assignedToUser: item.assignedToUser,
    assignedByUser: item.assignedByUser,
    _count: item._count,
  }));

  return (
    <SeguimientosClient
      followUps={serializedFollowUps}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
      isAdmin={user.role === "admin"}
      assignableUsers={users}
      assignableProperties={properties}
      filterQ={q}
      filterStatus={status}
    />
  );
}
