import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { getReceiptBooks, listReceipts, normalizeMonth } from "@/lib/rentals/views";
import { RentalsHeader } from "../_ui/rentals-header";
import { ReceiptsView } from "../_ui/receipts-view";

interface Props {
  searchParams: Promise<{ mes?: string; tipo?: string; estado?: string; q?: string }>;
}

export default async function RecibosPage({ searchParams }: Readonly<Props>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const month = normalizeMonth(sp.mes);
  const kind = sp.tipo === "inquilino" || sp.tipo === "propietario" ? sp.tipo : "";
  const status = sp.estado === "anulado" ? "anulado" : "";
  const q = sp.q?.trim() ?? "";
  const [books, receipts, pendingProofs] = await Promise.all([
    getReceiptBooks(),
    listReceipts({ month: q ? undefined : month, kind: kind || undefined, status: status || undefined, q: q || undefined }),
    prisma.rentalServiceProof.count({ where: { status: "pendiente" } }),
  ]);
  const issued = receipts.filter((r) => r.status === "emitido").length;
  return (
    <div className="flex flex-col gap-5">
      <RentalsHeader tab="recibos" pendingProofs={pendingProofs} subtitle={`${issued} ${issued === 1 ? "recibo emitido" : "recibos emitidos"}${q ? " para la búsqueda" : ""}`} />
      <ReceiptsView books={books} receipts={receipts} month={month} kind={kind} status={status} q={q} />
    </div>
  );
}
