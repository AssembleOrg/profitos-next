import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ContactosClient } from "./_components/contactos-client";
import type { NoteAttachment } from "@/components/notes/media-uploader";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    leadStatus?: string;
    tab?: string;
    hideDeleted?: string;
  }>;
}

export default async function ContactosPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = (sp.q ?? "").trim();
  const leadStatus = (sp.leadStatus ?? "").trim();
  const tab = sp.tab ?? "tokko";
  const hideDeleted = sp.hideDeleted === "true";

  if (tab === "manual") {
    // Manual clients (existing behavior)
    const clientWhere = user.role === "admin" ? {} : { userId: user.id };
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where: {
          ...clientWhere,
          ...(q && {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
            ],
          }),
        },
        include: { _count: { select: { visitas: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.client.count({
        where: {
          ...clientWhere,
          ...(q && {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
            ],
          }),
        },
      }),
    ]);

    const serializedClients = clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      attachments: (c.attachments as NoteAttachment[] | null) ?? null,
      createdAt: c.createdAt.toISOString(),
      _count: c._count,
    }));

    return (
      <ContactosClient
        tab="manual"
        clients={serializedClients}
        tokkoContacts={[]}
        page={page}
        totalPages={Math.ceil(total / limit)}
        total={total}
        limit={limit}
        isAdmin={user.role === "admin"}
        filters={{ q, leadStatus }}
      />
    );
  }

  // Tokko contacts (RecentContact)
  const andFilters: Prisma.RecentContactWhereInput[] = [];

  if (hideDeleted) {
    andFilters.push({ externalDeletedAt: null });
  }

  if (q) {
    andFilters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { cellphone: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (leadStatus) {
    andFilters.push({ leadStatus: { equals: leadStatus, mode: "insensitive" } });
  }

  const where: Prisma.RecentContactWhereInput = andFilters.length > 0 ? { AND: andFilters } : {};

  const [contacts, total, totalAll] = await Promise.all([
    prisma.recentContact.findMany({
      where,
      orderBy: [{ externalCreatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        externalId: true,
        name: true,
        email: true,
        phone: true,
        cellphone: true,
        leadStatus: true,
        isCompany: true,
        isOwner: true,
        agentName: true,
        agentEmail: true,
        tags: true,
        externalCreatedAt: true,
        externalDeletedAt: true,
        createdAt: true,
      },
    }),
    prisma.recentContact.count({ where }),
    prisma.recentContact.count(),
  ]);

  const serializedTokko = contacts.map((c) => ({
    id: c.id,
    externalId: c.externalId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    cellphone: c.cellphone,
    leadStatus: c.leadStatus,
    isCompany: c.isCompany,
    isOwner: c.isOwner,
    agentName: c.agentName,
    agentEmail: c.agentEmail,
    tags: c.tags as string[],
    externalCreatedAt: c.externalCreatedAt?.toISOString() ?? null,
    externalDeletedAt: c.externalDeletedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  // Get distinct leadStatus values for filter dropdown
  const leadStatuses = await prisma.recentContact.groupBy({
    by: ["leadStatus"],
    _count: { _all: true },
    orderBy: { leadStatus: "asc" },
  });

  const leadStatusOptions = leadStatuses
    .filter((s) => s.leadStatus)
    .map((s) => ({ value: s.leadStatus!, count: s._count._all }));

  return (
    <ContactosClient
      tab="tokko"
      clients={[]}
      tokkoContacts={serializedTokko}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
      totalAll={totalAll}
      isAdmin={user.role === "admin"}
      filters={{ q, leadStatus, hideDeleted }}
      leadStatusOptions={leadStatusOptions}
    />
  );
}
