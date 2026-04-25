import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { ObjetivosClient } from "../objetivos/_components/objetivos-client";
import { serializeCard } from "../objetivos/_components/serialize";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function MisObjetivosPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE),
  );
  const from = sp.from?.trim() ?? "";
  const to = sp.to?.trim() ?? "";

  const where: Record<string, unknown> = { assignedToUserId: user.id };
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) where.endDate = { gte: d };
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) where.startDate = { lte: d };
  }

  const [cards, total] = await Promise.all([
    prisma.objectiveCard.findMany({
      where,
      include: {
        assignedToUser: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
        createdByUser: { select: { id: true, email: true, fullName: true } },
        items: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            evaluatedByUser: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.objectiveCard.count({ where }),
  ]);

  const serializedCards = cards.map(serializeCard);

  return (
    <ObjetivosClient
      initialCards={serializedCards}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      total={total}
      limit={limit}
      isAdmin={false}
      currentUserId={user.id}
      users={[]}
      filters={{ assignedToUserId: "", from, to }}
    />
  );
}
