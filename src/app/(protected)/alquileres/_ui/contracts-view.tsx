"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ContractRow } from "@/lib/rentals/dto";
import type { ContractFilter } from "@/lib/rentals/views";
import { IconFile, IconSearch } from "./icons";
import { AdjustPill, ContractPill, DuePill, Empty, Pill, dateAR, money, propertyLine } from "./kit";

const FILTERS: Array<{ value: ContractFilter; label: string }> = [
  { value: "vigentes", label: "Vigentes" },
  { value: "con_deuda", label: "Con deuda" },
  { value: "aumentan", label: "Aumentan pronto" },
  { value: "por_vencer", label: "Por terminar" },
  { value: "finalizados", label: "Finalizados" },
  { value: "temporales", label: "Temporales" },
  { value: "todos", label: "Todos" },
];

function adjustText(r: ContractRow) {
  if (!r.adjustment.everyMonths && !r.adjustment.index) return "Sin aumentos";
  const every = r.adjustment.everyMonths ? `Cada ${r.adjustment.everyMonths} m` : "";
  return [every, r.adjustment.index].filter(Boolean).join(" · ");
}

export function ContractsView({
  rows,
  counts,
  filter,
  q,
}: {
  rows: ContractRow[];
  counts: Record<ContractFilter, number>;
  filter: ContractFilter;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);

  function navigate(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="radiogroup" aria-label="Filtrar contratos" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          {FILTERS.filter((f) => f.value !== "temporales" || counts.temporales > 0).map((f) => {
            const active = f.value === filter;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => navigate({ filtro: f.value === "vigentes" ? null : f.value })}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition-colors ${
                  active ? "bg-dark font-bold text-dark-fg" : "border border-border bg-surface font-medium text-text-muted hover:text-text"
                }`}
              >
                {f.label}
                <span className={`tabular-nums ${active ? "text-accent" : "text-text-faint"}`}>{counts[f.value]}</span>
              </button>
            );
          })}
        </div>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: search.trim() || null });
          }}
          className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-2 focus-within:border-accent lg:w-72"
        >
          <IconSearch size={16} className="shrink-0 text-text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => search.trim() !== q && navigate({ q: search.trim() || null })}
            placeholder="Dirección, inquilino, DNI o dueño"
            aria-label="Buscar contratos"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
          />
          {pending && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-label="Cargando" />}
        </form>
      </div>

      {rows.length === 0 ? (
        <Empty title={q ? "Ningún contrato coincide" : "No hay contratos en esta vista"} icon={<IconFile size={20} />}>
          {q ? "Probá con otra dirección o nombre." : (
            <Link href="/alquileres/contratos/nuevo" className="font-semibold text-terra hover:underline">
              Cargar un contrato
            </Link>
          )}
        </Empty>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface md:block">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {["Propiedad", "Alquiler", "Próximo vencimiento", "Aumento", "Contrato"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/alquileres/${r.id}`)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-bg"
                  >
                    <td className="max-w-[320px] px-4 py-3">
                      <Link href={`/alquileres/${r.id}`} onClick={(e) => e.stopPropagation()} className="block truncate text-[13.5px] font-bold text-text hover:underline">
                        {propertyLine(r.property.address, r.unit)}
                      </Link>
                      <p className="truncate text-[11.5px] text-text-faint">
                        {r.tenant.fullName}
                        {r.owner ? ` · prop. ${r.owner.fullName}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-display text-[14px] font-bold tabular-nums text-text">{money(r.baseAmount, r.currency)}</p>
                      <p className="text-[11.5px] text-text-faint">Honorarios {r.feePercent}%</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.nextDue ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] tabular-nums text-text">{dateAR(r.nextDue.date)}</span>
                          <DuePill status={r.nextDue.status} />
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-text-faint">Sin cuotas pendientes</span>
                      )}
                      {r.overdueCount > 0 && (
                        <p className="text-[11.5px] font-semibold text-terra">
                          Debe {money(r.overdueAmount, r.currency)} ({r.overdueCount} {r.overdueCount === 1 ? "cuota" : "cuotas"})
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-[12.5px] text-text-muted">{adjustText(r)}</p>
                      {r.adjustment.nextDate && r.status !== "finalizado" && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[11.5px] tabular-nums text-text-faint">{dateAR(r.adjustment.nextDate)}</span>
                          <AdjustPill alert={r.adjustment.alert} />
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ContractPill status={r.status} />
                        {r.kind === "temporal" && <Pill tone="bg-info-chip text-info">Temporal</Pill>}
                      </div>
                      <p className="mt-0.5 text-[11.5px] tabular-nums text-text-faint">
                        {dateAR(r.startDate)} → {dateAR(r.endDate)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <ul className="flex flex-col gap-2.5 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/alquileres/${r.id}`} className="block rounded-[18px] border border-border bg-surface p-3.5 active:bg-bg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold text-text">{propertyLine(r.property.address, r.unit)}</p>
                      <p className="truncate text-[12px] text-text-faint">{r.tenant.fullName}</p>
                    </div>
                    <ContractPill status={r.status} />
                  </div>
                  <div className="mt-2.5 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-display text-[18px] font-bold tabular-nums text-text">{money(r.baseAmount, r.currency)}</p>
                      <p className="text-[11.5px] text-text-faint">{adjustText(r)}</p>
                    </div>
                    {r.nextDue && (
                      <div className="text-right">
                        <DuePill status={r.nextDue.status} />
                        <p className="mt-0.5 text-[11.5px] tabular-nums text-text-faint">{dateAR(r.nextDue.date)}</p>
                      </div>
                    )}
                  </div>
                  {(r.overdueCount > 0 || r.adjustment.alert !== "none") && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                      {r.overdueCount > 0 && (
                        <span className="text-[11.5px] font-semibold text-terra">Debe {money(r.overdueAmount, r.currency)}</span>
                      )}
                      <AdjustPill alert={r.status === "finalizado" ? "none" : r.adjustment.alert} />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
