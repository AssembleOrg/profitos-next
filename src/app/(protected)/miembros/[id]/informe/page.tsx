import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { InformeClient } from "./_components/informe-client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function InformePage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;

  // Default: first day of current month → today
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const from = sp.from ?? defaultFrom;
  const to = sp.to ?? defaultTo;

  return <InformeClient memberId={id} from={from} to={to} />;
}
