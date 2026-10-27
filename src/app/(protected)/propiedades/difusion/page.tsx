import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDifusionData } from "@/lib/publish/difusion-view";
import { DifusionClient } from "./_components/difusion-client";

export default async function DifusionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { portals, listings, unlisted } = await getDifusionData();
  return <DifusionClient portals={portals} listings={listings} unlisted={unlisted} />;
}
