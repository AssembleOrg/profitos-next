import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { PeopleView } from "../alquileres/_ui/people-view";

export default async function PropietariosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const today = new Date();
  const owners = await prisma.owner.findMany({
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
      kind="propietario"
      isAdmin={user.role === "admin"}
      rows={owners.map((o) => ({
        id: o.id,
        fullName: o.fullName,
        idType: o.idType,
        idNumber: o.idNumber,
        phone: o.phone,
        email: o.email,
        notes: o.notes,
        contractsCount: o._count.contracts,
        activeContracts: o.contracts.map((c) => ({ id: c.id, address: c.property.address, unit: c.unit })),
      }))}
    />
  );
}
