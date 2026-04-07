import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ConsultantsClient } from "./_components/consultants-client";

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function ConsultantsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [items, total] = await Promise.all([
    prisma.recentContact.findMany({
      orderBy: [{ tokkoCreatedAt: "desc" }, { tokkoContactId: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.recentContact.count(),
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
      items={serialized}
      page={page}
      total={total}
      totalPages={Math.ceil(total / PAGE_SIZE)}
    />
  );
}
