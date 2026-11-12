"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { SelectField } from "@/components/ui/select-field";
import { DateField } from "../../_components/date-field";
import { FilterBar, FilterChip } from "../../_components/filter-bar";

const TABS = [
  ["resumen", "Resumen"],
  ["propiedades", "Propiedades"],
  ["busquedas", "Búsquedas"],
  ["personas", "Personas"],
  ["calidad", "Calidad de datos"],
] as const;

const PERIODS = [
  ["1", "Hoy"],
  ["7", "7 días"],
  ["30", "30 días"],
  ["90", "90 días"],
  ["365", "1 año"],
] as const;

const DEVICES: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computadora" };
const OPERATIONS: Record<string, string> = { venta: "Venta", alquiler: "Alquiler", temporario: "Temporario" };

type Options = { channels: string[]; devices: string[]; operations: string[]; types: string[]; zones: string[] };

export function InsightsFilters({ options, active }: { options: Options; active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    start(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  const custom = Boolean(params.get("desde"));
  const days = custom ? "" : params.get("dias") ?? "30";
  const filterCount = ["dispositivo", "canal", "persona", "op", "tipo", "zona"].filter((key) => params.get(key)).length;
  const clearFilters = () => update({ dispositivo: undefined, canal: undefined, persona: undefined, op: undefined, tipo: undefined, zona: undefined });
  const exportHref = `${pathname}/exportar?${new URLSearchParams({ ...Object.fromEntries(params.entries()), tab: active }).toString()}`;

  return (
    <div className="flex flex-col gap-3" data-pending={pending} style={{ opacity: pending ? 0.6 : 1, transition: "opacity 200ms" }}>
      <nav className="-mx-5 flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0" aria-label="Secciones">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-current={active === key ? "page" : undefined}
            onClick={() => update({ tab: key === "resumen" ? undefined : key })}
            className={`min-h-11 whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium ${active === key ? "bg-text text-bg" : "text-text-muted hover:bg-surface-elevated"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <FilterBar
        activeCount={filterCount}
        onClear={clearFilters}
        chips={
          <>
            {PERIODS.map(([value, label]) => (
              <FilterChip key={value} active={days === value} onClick={() => update({ dias: value === "30" ? undefined : value, desde: undefined, hasta: undefined })}>
                {label}
              </FilterChip>
            ))}
            <a href={exportHref} className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted hover:text-text lg:ml-auto">
              Exportar CSV
            </a>
          </>
        }
        fields={
          <>
          <DateField value={params.get("desde") ?? ""} onChange={(value: string) => update({ desde: value || undefined, dias: undefined })} placeholder="Desde" />
          <DateField value={params.get("hasta") ?? ""} onChange={(value: string) => update({ hasta: value || undefined, dias: undefined })} placeholder="Hasta" />
          <SelectField aria-label="Personas" value={params.get("persona") ?? ""} onChange={(event) => update({ persona: event.target.value || undefined })}>
            <option value="">Todas las personas</option>
            <option value="registrados">Registradas</option>
            <option value="anonimos">Anónimas</option>
          </SelectField>
          <SelectField aria-label="Dispositivo" value={params.get("dispositivo") ?? ""} onChange={(event) => update({ dispositivo: event.target.value || undefined })}>
            <option value="">Todo dispositivo</option>
            {options.devices.map((value) => <option key={value} value={value}>{DEVICES[value] ?? value}</option>)}
          </SelectField>
          <SelectField aria-label="Canal" value={params.get("canal") ?? ""} onChange={(event) => update({ canal: event.target.value || undefined })}>
            <option value="">Todo canal</option>
            {options.channels.map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectField>
          <SelectField aria-label="Operación" value={params.get("op") ?? ""} onChange={(event) => update({ op: event.target.value || undefined })}>
            <option value="">Toda operación</option>
            {options.operations.map((value) => <option key={value} value={value}>{OPERATIONS[value] ?? value}</option>)}
          </SelectField>
          <SelectField aria-label="Tipo" value={params.get("tipo") ?? ""} onChange={(event) => update({ tipo: event.target.value || undefined })}>
            <option value="">Todo tipo</option>
            {options.types.map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectField>
          <SelectField aria-label="Zona" value={params.get("zona") ?? ""} onChange={(event) => update({ zona: event.target.value || undefined })}>
            <option value="">Toda zona</option>
            {options.zones.map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectField>
          {filterCount > 0 && (
            <button type="button" className="hidden h-11 self-center justify-self-start text-[13px] font-medium text-text underline underline-offset-2 lg:block" onClick={clearFilters}>
              Limpiar {filterCount} {filterCount === 1 ? "filtro" : "filtros"}
            </button>
          )}
          </>
        }
      />
    </div>
  );
}
