import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import { SeguimientosClient } from "./_components/seguimientos-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; limit?: string; q?: string; status?: string; vencidos?: string; assignee?: string }>;
}

export default async function SeguimientosPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "admin";

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";
  const assignee = isAdmin ? sp.assignee?.trim() ?? "" : "";
  const vencidos = sp.vencidos === "1";

  // Base: rol + vendedor + búsqueda. Los contadores usan esta misma base (sin estado ni vencidos).
  const base: Prisma.PropertyFollowUpWhereInput = isAdmin ? {} : { assignedToUserId: user.id };
  if (assignee) base.assignedToUserId = assignee;
  if (q) {
    base.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { phone: { contains: q } } },
      { client: { email: { contains: q, mode: "insensitive" } } },
      { assignedToUser: { fullName: { contains: q, mode: "insensitive" } } },
      { assignedToUser: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const where: Prisma.PropertyFollowUpWhereInput = { ...base };
  if (status) where.status = status;
  // Deep-link desde el dashboard: misma definición que el KPI "vencidos" del API.
  if (vencidos) {
    where.status = { notIn: ["hecho", "cancelado"] };
    where.dueDate = { lt: new Date() };
  }

  const [followUps, total, counts, users, properties] = await Promise.all([
    prisma.propertyFollowUp.findMany({
      where,
      include: {
        property: { select: { id: true, address: true, city: true, zone: true, coverImageUrl: true } },
        assignedToUser: { select: { id: true, email: true, fullName: true } },
        client: { select: { id: true, name: true, phone: true, email: true } },
        actions: { select: { type: true, description: true, actionAt: true }, orderBy: { actionAt: "desc" }, take: 1 },
        _count: { select: { actions: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.propertyFollowUp.count({ where }),
    prisma.propertyFollowUp.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    isAdmin
      ? prisma.user.findMany({ select: { id: true, fullName: true, email: true }, orderBy: [{ fullName: "asc" }, { email: "asc" }] })
      : Promise.resolve([]),
    isAdmin
      ? prisma.property.findMany({ select: { id: true, address: true, city: true, zone: true }, orderBy: { createdAt: "desc" }, take: 300 })
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
    client: item.client,
    lastAction: item.actions[0]
      ? { type: item.actions[0].type, description: item.actions[0].description, actionAt: item.actions[0].actionAt.toISOString() }
      : null,
    _count: item._count,
  }));

  return (
    <SeguimientosClient
      followUps={serializedFollowUps}
      statusCounts={Object.fromEntries(counts.map((c) => [c.status, c._count._all]))}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
      isAdmin={isAdmin}
      assignableUsers={users}
      assignableProperties={properties}
      filterQ={q}
      filterStatus={status}
      filterAssignee={assignee}
      filterVencidos={vencidos}
    />
  );
}
