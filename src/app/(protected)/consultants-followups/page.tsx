import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { ConsultantsFollowUpsClient } from "./_components/consultants-followups-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
  }>;
}

export default async function ConsultantsFollowUpsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim().toLowerCase();

  const and: Prisma.ContactFollowUpWhereInput[] = [];
  if (user.role !== "admin") and.push({ assignedToUserId: user.id });
  if (status) and.push({ status });
  if (q) {
    and.push({
      OR: [
        { recentContact: { name: { contains: q, mode: "insensitive" } } },
        { recentContact: { email: { contains: q, mode: "insensitive" } } },
        { recentContact: { phone: { contains: q, mode: "insensitive" } } },
        { recentContact: { cellphone: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  const where: Prisma.ContactFollowUpWhereInput = and.length ? { AND: and } : {};

  const [items, total, users] = await Promise.all([
    prisma.contactFollowUp.findMany({
      where,
      include: {
        recentContact: true,
        assignedToUser: { select: { id: true, email: true, fullName: true } },
        assignedByUser: { select: { id: true, email: true, fullName: true } },
        _count: { select: { actions: true, statusChanges: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contactFollowUp.count({ where }),
    user.role === "admin"
      ? prisma.user.findMany({
          select: { id: true, email: true, fullName: true },
          orderBy: [{ fullName: "asc" }, { email: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const serialized = items.map((item) => ({
    id: item.id,
    status: item.status,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    recentContact: {
      ...item.recentContact,
      tokkoCreatedAt: item.recentContact.tokkoCreatedAt?.toISOString() ?? null,
      tokkoDeletedAt: item.recentContact.tokkoDeletedAt?.toISOString() ?? null,
      syncAt: item.recentContact.syncAt?.toISOString() ?? null,
      createdAt: item.recentContact.createdAt.toISOString(),
      updatedAt: item.recentContact.updatedAt.toISOString(),
    },
    assignedToUser: item.assignedToUser,
    assignedByUser: item.assignedByUser,
    _count: item._count,
  }));

  return (
    <ConsultantsFollowUpsClient
      isAdmin={user.role === "admin"}
      page={page}
      total={total}
      totalPages={Math.ceil(total / PAGE_SIZE)}
      filters={{ q, status }}
      items={serialized}
      assignableUsers={users}
    />
  );
}

