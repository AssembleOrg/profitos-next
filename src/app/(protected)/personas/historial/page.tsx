import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { HistorialClient } from "./_components/historial-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function HistorialPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));

  const [rows, total] = await Promise.all([
    prisma.buscalaConsulta.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.buscalaConsulta.count(),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    identifier: r.identifier,
    kind: r.kind as "cuit" | "dni",
    buscalaReportId: r.buscalaReportId,
    label: r.label,
    createdAt: r.createdAt.toISOString(),
    author: r.user?.fullName ?? r.user?.email ?? null,
  }));

  return (
    <HistorialClient
      items={items}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
    />
  );
}
