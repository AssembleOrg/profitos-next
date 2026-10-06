import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getContractDossier, todayISO } from "@/lib/rentals/views";
import { DossierView } from "../_ui/dossier-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LegajoPage({ params }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const dossier = await getContractDossier(id);
  if (!dossier) notFound();
  return <DossierView d={dossier} today={todayISO()} />;
}
