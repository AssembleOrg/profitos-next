import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { PeopleView } from "../alquileres/_ui/people-view";

export default async function InquilinosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const today = new Date();
  const tenants = await prisma.tenant.findMany({
    orderBy: { fullName: "asc" },
    take: 2000,
    include: {
      _count: { select: { contracts: true } },
      contracts: {
        where: { endDate: { gte: today } },
        select: { id: true, unit: true, property: { select: { address: true } } },
        orderBy: { startDate: "desc" },
      },
    },
  });
  return (
    <PeopleView
      kind="inquilino"
      isAdmin={user.role === "admin"}
      rows={tenants.map((t) => ({
        id: t.id,
        fullName: t.fullName,
        idType: t.idType,
        idNumber: t.idNumber,
        phone: t.phone,
        email: t.email,
        notes: t.notes,
        contractsCount: t._count.contracts,
        activeContracts: t.contracts.map((c) => ({ id: c.id, address: c.property.address, unit: c.unit })),
        portal: {
          enabled: t.portalEnabled,
          hasAccount: Boolean(t.authUserId),
          invitedAt: t.portalInvitedAt?.toISOString() ?? null,
          lastLoginAt: t.portalLastLoginAt?.toISOString() ?? null,
        },
      }))}
    />
  );
}
