import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ConsultantsClient } from "./_components/consultants-client";
import { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    q?: string;
    agent?: string;
    lead?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}

export default async function ConsultantsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const agent = (sp.agent ?? "").trim();
  const lead = (sp.lead ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const sort = (sp.sort ?? "created_desc").trim();

  const andFilters: Prisma.RecentContactWhereInput[] = [];
  if (q) {
    andFilters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { cellphone: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (agent) andFilters.push({ agentName: { equals: agent, mode: "insensitive" } });
  if (lead) andFilters.push({ leadStatus: { equals: lead, mode: "insensitive" } });
  if (from) andFilters.push({ tokkoCreatedAt: { gte: new Date(`${from}T00:00:00`) } });
  if (to) andFilters.push({ tokkoCreatedAt: { lte: new Date(`${to}T23:59:59`) } });
  const where: Prisma.RecentContactWhereInput = andFilters.length > 0 ? { AND: andFilters } : {};

  const orderBy: Prisma.RecentContactOrderByWithRelationInput[] =
    sort === "created_asc"
      ? [{ tokkoCreatedAt: "asc" }, { tokkoContactId: "asc" }]
      : sort === "name_asc"
        ? [{ name: "asc" }]
        : sort === "name_desc"
          ? [{ name: "desc" }]
          : [{ tokkoCreatedAt: "desc" }, { tokkoContactId: "desc" }];

  const [items, total, totalAll, syncState, leadOptions, agentOptions] = await Promise.all([
    prisma.recentContact.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.recentContact.count({ where }),
    prisma.recentContact.count(),
    prisma.integrationSyncState.findUnique({
      where: { integrationKey: "tokko_contacts" },
      select: { lastRunAt: true },
    }),
    prisma.recentContact.findMany({
      where: { leadStatus: { not: null } },
      distinct: ["leadStatus"],
      select: { leadStatus: true },
      orderBy: { leadStatus: "asc" },
      take: 100,
    }),
    prisma.recentContact.findMany({
      where: { agentName: { not: null } },
      distinct: ["agentName"],
      select: { agentName: true },
      orderBy: { agentName: "asc" },
      take: 300,
    }),
  ]);

  const serialized = items.map((row: {
    id: string;
    tokkoContactId: number;
    name: string;
    email: string | null;
    phone: string | null;
    cellphone: string | null;
    leadStatus: string | null;
    agentName: string | null;
    agentEmail: string | null;
    tokkoCreatedAt: Date | null;
    syncAt: Date | null;
  }) => ({
    id: row.id,
    tokkoContactId: row.tokkoContactId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    cellphone: row.cellphone,
    leadStatus: row.leadStatus,
    agentName: row.agentName,
    agentEmail: row.agentEmail,
    tokkoCreatedAt: row.tokkoCreatedAt ? row.tokkoCreatedAt.toISOString() : null,
    syncAt: row.syncAt ? row.syncAt.toISOString() : null,
  }));

  return (
    <ConsultantsClient
      isAdmin={user.role === "admin"}
      currentUserEmail={user.email}
      items={serialized}
      page={page}
      total={total}
      totalAll={totalAll}
      totalPages={Math.ceil(total / PAGE_SIZE)}
      lastSyncRunAt={syncState?.lastRunAt ? syncState.lastRunAt.toISOString() : null}
      filters={{ q, agent, lead, from, to, sort }}
      leadOptions={leadOptions.map((x) => x.leadStatus).filter((x): x is string => !!x)}
      agentOptions={agentOptions.map((x) => x.agentName).filter((x): x is string => !!x)}
    />
  );
}
