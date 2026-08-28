import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getInboxMessages } from "@/lib/messages/inbox";
import { ConsultantsClient } from "./_components/consultants-client";

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    portal?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function ConsultantsPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.limit ?? `${PAGE_SIZE}`, 10) || PAGE_SIZE));
  const q = (sp.q ?? "").trim();
  const portal = (sp.portal ?? "").trim();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();

  const { items, total, totalAll, counts } = await getInboxMessages({ portal, q, from, to, page, limit });

  return (
    <ConsultantsClient
      items={items}
      page={page}
      total={total}
      totalAll={totalAll}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      limit={limit}
      counts={counts}
      filters={{ q, portal, from, to }}
    />
  );
}
