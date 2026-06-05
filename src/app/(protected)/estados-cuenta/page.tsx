import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { now } from "@/lib/datetime";
import { getAccountReport, type MovementFilters } from "@/lib/account/server";
import { isCurrency, isEntryType } from "@/lib/account";
import { EstadosCuentaClient, type AccountFilters } from "./_components/estados-cuenta-client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Props {
  searchParams: Promise<{
    from?: string;
    to?: string;
    type?: string;
    currency?: string;
    categoryId?: string;
    agentUserId?: string;
    shared?: string;
    view?: string;
  }>;
}

export default async function EstadosCuentaPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;

  const today = now();
  const defaultFrom = today.startOf("month").toISODate()!;
  const defaultTo = today.toISODate()!;

  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : defaultFrom;
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : defaultTo;
  const view: AccountFilters["view"] = sp.view === "mensual" ? "mensual" : "rango";

  const isShared = sp.shared === "1" ? true : sp.shared === "0" ? false : undefined;

  const filters: MovementFilters = { from, to };
  if (isEntryType(sp.type)) filters.type = sp.type;
  if (sp.categoryId) filters.categoryId = sp.categoryId;
  if (isCurrency(sp.currency)) filters.currency = sp.currency;
  if (sp.agentUserId) filters.agentUserId = sp.agentUserId;
  if (isShared !== undefined) filters.isShared = isShared;

  const [report, categories, agents] = await Promise.all([
    getAccountReport(filters),
    prisma.accountCategory.findMany({
      where: { archivedAt: null },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      select: { id: true, fullName: true, email: true },
      orderBy: [{ fullName: "asc" }],
    }),
  ]);

  const appliedFilters: AccountFilters = {
    from,
    to,
    view,
    type: isEntryType(sp.type) ? sp.type : undefined,
    currency: isCurrency(sp.currency) ? sp.currency : undefined,
    categoryId: sp.categoryId || undefined,
    agentUserId: sp.agentUserId || undefined,
    isShared,
  };

  return (
    <EstadosCuentaClient
      report={report}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind as "income" | "expense",
        color: c.color,
        isSystem: c.isSystem,
      }))}
      agents={agents.map((a) => ({ id: a.id, name: a.fullName?.trim() || a.email }))}
      filters={appliedFilters}
      isAdmin={user.role === "admin"}
    />
  );
}
