import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgendaMonth, normalizeMonth } from "@/lib/rentals/views";
import { RentalsHeader } from "./_ui/rentals-header";
import { AgendaView } from "./_ui/agenda-view";
import { monthLabel } from "./_ui/format";

interface Props {
  searchParams: Promise<{ mes?: string; q?: string }>;
}

export default async function AlquileresAgendaPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const month = normalizeMonth(sp.mes);
  const q = sp.q?.trim() ?? "";
  const data = await getAgendaMonth(month, q || undefined);
  const count = data.dues.length;

  return (
    <div className="flex flex-col gap-5">
      <RentalsHeader
        tab="agenda"
        pendingProofs={data.pendingProofs}
        subtitle={`${monthLabel(month)} · ${count === 1 ? "1 vencimiento" : `${count} vencimientos`}`}
      />
      <AgendaView data={data} q={q} />
    </div>
  );
}
