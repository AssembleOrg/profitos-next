import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getInboxMessages } from "@/lib/messages/inbox";
import { prisma } from "@/lib/prisma/client";
import { ConsultantsClient } from "./_components/consultants-client";

const PAGE_SIZE = 21; // grilla de 3 columnas

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    portal?: string;
    from?: string;
    to?: string;
    estado?: string;
    mine?: string;
  }>;
}

export default async function ConsultantsPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "admin";

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = (sp.q ?? "").trim();
  const portal = (sp.portal ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const estado = (sp.estado ?? "nuevos").trim();
  // Default no-admin: sus contactos (responsabilidades); admin: todos.
  const mine = sp.mine != null ? sp.mine === "1" : !isAdmin;

  const [{ items, total, totalAll, counts }, users] = await Promise.all([
    getInboxMessages({ portal, q, from, to, page, limit, estado, mine }, { userId: user.id, isAdmin }),
    prisma.user.findMany({
      select: { id: true, fullName: true, email: true },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
    }),
  ]);

  return (
    <ConsultantsClient
      items={items}
      page={page}
      total={total}
      totalAll={totalAll}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      limit={limit}
      counts={counts}
      filters={{ q, portal, from, to, estado, mine }}
      viewer={{ userId: user.id, isAdmin }}
      users={users}
    />
  );
}
