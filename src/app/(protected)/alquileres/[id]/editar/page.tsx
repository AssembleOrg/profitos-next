import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getContractDossier, getContractFormOptions } from "@/lib/rentals/views";
import { ContractForm } from "../../_ui/contract-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarContratoPage({ params }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const [dossier, options] = await Promise.all([getContractDossier(id), getContractFormOptions()]);
  if (!dossier) notFound();
  return <ContractForm options={options} initial={dossier} />;
}
