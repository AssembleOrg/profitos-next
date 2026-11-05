import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentAccess } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma/client";
import { isAccountArea } from "@/lib/account";
import { getCashOverview } from "@/lib/account/cash-server";
import { getCostearPhoneForEmail } from "@/lib/costear/client";
import { CajaClient } from "./_components/caja-client";

export default async function CajaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const access = await getCurrentAccess();
  const isAdmin = access?.isAdmin ?? false;

  const [overview, categories] = await Promise.all([
    getCashOverview({ isAdmin }),
    prisma.accountCategory.findMany({
      where: { archivedAt: null },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <CajaClient
      overview={overview}
      currentUserId={user.id}
      isCostearOwner={getCostearPhoneForEmail(user.email) !== null}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind as "income" | "expense",
        color: c.color,
        isSystem: c.isSystem,
        area: isAccountArea(c.area) ? c.area : null,
      }))}
    />
  );
}
