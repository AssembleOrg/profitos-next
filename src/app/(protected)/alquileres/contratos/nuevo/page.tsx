import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getContractFormOptions } from "@/lib/rentals/views";
import { ContractForm } from "../../_ui/contract-form";

export default async function NuevoContratoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const options = await getContractFormOptions();
  return <ContractForm options={options} />;
}
