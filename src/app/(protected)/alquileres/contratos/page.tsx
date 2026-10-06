import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { listContracts, type ContractFilter } from "@/lib/rentals/views";
import { RentalsHeader } from "../_ui/rentals-header";
import { ContractsView } from "../_ui/contracts-view";

const FILTERS: ContractFilter[] = ["todos", "vigentes", "por_vencer", "con_deuda", "aumentan", "finalizados", "temporales"];

interface Props {
  searchParams: Promise<{ filtro?: string; q?: string }>;
}

export default async function ContratosPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const filter = (FILTERS as string[]).includes(sp.filtro ?? "") ? (sp.filtro as ContractFilter) : "vigentes";
  const q = sp.q?.trim() ?? "";
  const [{ rows, counts }, pendingProofs] = await Promise.all([
    listContracts({ q: q || undefined, filter }),
    prisma.rentalServiceProof.count({ where: { status: "pendiente" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <RentalsHeader
        tab="contratos"
        pendingProofs={pendingProofs}
        subtitle={`${counts.vigentes} ${counts.vigentes === 1 ? "contrato vigente" : "contratos vigentes"}${counts.con_deuda ? ` · ${counts.con_deuda} con deuda` : ""}`}
      />
      <ContractsView rows={rows} counts={counts} filter={filter} q={q} />
    </div>
  );
}
