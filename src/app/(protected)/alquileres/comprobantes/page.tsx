import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { listServiceProofs } from "@/lib/rentals/views";
import { RentalsHeader } from "../_ui/rentals-header";
import { ProofsView } from "../_ui/proofs-view";

interface Props {
  searchParams: Promise<{ estado?: string }>;
}

export default async function ComprobantesPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const status = ["aprobado", "rechazado", "todos"].includes(sp.estado ?? "") ? sp.estado! : "pendiente";
  const [proofs, grouped] = await Promise.all([
    listServiceProofs(status === "todos" ? undefined : status),
    prisma.rentalServiceProof.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = { pendiente: 0, aprobado: 0, rechazado: 0, todos: 0 };
  for (const g of grouped) {
    counts[g.status] = g._count._all;
    counts.todos += g._count._all;
  }
  return (
    <div className="flex flex-col gap-5">
      <RentalsHeader
        tab="comprobantes"
        pendingProofs={counts.pendiente}
        subtitle={counts.pendiente ? `${counts.pendiente} para revisar` : "Comprobantes de servicios de los inquilinos"}
      />
      <ProofsView proofs={proofs} status={status} counts={counts} />
    </div>
  );
}
