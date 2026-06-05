import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { fromISO } from "@/lib/datetime";
import { TasacionesClient } from "./_components/tasaciones-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; limit?: string; q?: string; status?: string; from?: string; to?: string }>;
}

export default async function TasacionesPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = fromISO(from).startOf("day").toJSDate();
  if (to) dateFilter.lte = fromISO(to).endOf("day").toJSDate();

  const where = {
    deletedAt: null,
    ...(user.role === "admin" ? {} : { userId: user.id }),
    ...(q && {
      OR: [
        { titulo: { contains: q, mode: "insensitive" as const } },
        { direccion: { contains: q, mode: "insensitive" as const } },
      ],
    }),
    ...(status && { status }),
    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
  };

  const [items, total] = await Promise.all([
    prisma.tasacion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.tasacion.count({ where }),
  ]);

  const serialized = items.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    direccion: t.direccion,
    status: t.status,
    userName: t.user?.fullName?.trim() || t.user?.email || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <TasacionesClient
      items={serialized}
      page={page}
      totalPages={Math.ceil(total / limit)}
      total={total}
      limit={limit}
      isAdmin={user.role === "admin"}
      filters={{ q, status, from, to }}
    />
  );
}
