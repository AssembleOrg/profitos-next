"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ServiceProofDTO } from "@/lib/rentals/dto";
import type { RentalAttachment } from "../_components/voice-recorder";
import { useSignedUrls } from "../_components/use-signed-urls";
import { ProofRow } from "./dossier-view";
import { IconUpload } from "./icons";
import { Empty, monthLabel, propertyLine } from "./kit";

const TABS = [
  { v: "pendiente", l: "Para revisar" },
  { v: "aprobado", l: "Aprobados" },
  { v: "rechazado", l: "Rechazados" },
  { v: "todos", l: "Todos" },
];

/** Bandeja de comprobantes de servicios que suben los inquilinos desde el portal. */
export function ProofsView({ proofs, status, counts }: { proofs: ServiceProofDTO[]; status: string; counts: Record<string, number> }) {
  const router = useRouter();
  const paths = proofs.flatMap((p) => (Array.isArray(p.attachments) ? (p.attachments as RentalAttachment[]).map((a) => a.path) : []));
  const urls = useSignedUrls(paths);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Estado de los comprobantes" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:px-0">
        {TABS.map((t) => {
          const active = t.v === status;
          return (
            <Link
              key={t.v}
              href={t.v === "pendiente" ? "/alquileres/comprobantes" : `/alquileres/comprobantes?estado=${t.v}`}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition-colors ${
                active ? "bg-dark font-bold text-dark-fg" : "border border-border bg-surface font-medium text-text-muted hover:text-text"
              }`}
            >
              {t.l}
              {counts[t.v] !== undefined && <span className={`tabular-nums ${active ? "text-accent" : "text-text-faint"}`}>{counts[t.v]}</span>}
            </Link>
          );
        })}
      </nav>
      {proofs.length === 0 ? (
        <Empty title={status === "pendiente" ? "No hay comprobantes para revisar" : "No hay comprobantes en esta vista"} icon={<IconUpload size={20} />}>
          Los inquilinos suben acá las boletas de luz, gas, agua y otros servicios que pagan por su cuenta.
        </Empty>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {proofs.map((p) => (
            <ProofRow
              key={p.id}
              p={p}
              urls={urls}
              variant="card"
              onChanged={() => router.refresh()}
              context={
                <p className="truncate text-[12px] text-text-muted">
                  <Link href={`/alquileres/${p.contractId}`} className="font-semibold hover:underline">
                    {p.property ? propertyLine(p.property.address, p.unit) : "Contrato"}
                  </Link>
                  {p.tenantName ? ` · ${p.tenantName}` : ""} · {monthLabel(p.period)}
                </p>
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
