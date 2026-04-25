import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { AdicionalesClient } from "./_components/adicionales-client";

export default async function AdicionalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const items = await prisma.rentalAdditional.findMany({
    include: { _count: { select: { contracts: true } } },
    orderBy: [{ name: "asc" }],
  });

  return (
    <AdicionalesClient
      initialItems={items.map((it) => ({
        id: it.id,
        name: it.name,
        defaultAmount: it.defaultAmount,
        notes: it.notes,
        contractsCount: it._count.contracts,
      }))}
    />
  );
}
