"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconClose, IconFilters } from "./icons";
import { Select, type SelectOption } from "./select";
import { Sheet } from "./sheet";
import { track } from "./tracker";

export type FilterValues = Record<string, string | undefined>;

const ROOMS: SelectOption[] = [
  { value: "1", label: "1 ambiente" },
  { value: "2", label: "2 ambientes" },
  { value: "3", label: "3 ambientes" },
  { value: "4", label: "4 ambientes" },
  { value: "5", label: "5 o más" },
];

const ORDER: SelectOption[] = [
  { value: "", label: "Más recientes" },
  { value: "precio-asc", label: "Menor precio" },
  { value: "precio-desc", label: "Mayor precio" },
  { value: "superficie", label: "Mayor superficie" },
];

const LABELS: Record<string, (value: string) => string> = {
  tipo: (value) => value,
  zona: (value) => value,
  amb: (value) => (value === "5" ? "5+ amb." : `${value} amb.`),
  dorm: (value) => `${value}+ dorm.`,
  sup: (value) => `Desde ${value} m²`,
  moneda: (value) => (value === "USD" ? "Dólares" : "Pesos"),
  min: (value) => `Desde ${Number(value).toLocaleString("es-AR")}`,
  max: (value) => `Hasta ${Number(value).toLocaleString("es-AR")}`,
  q: (value) => `“${value}”`,
  ids: () => "Mis favoritas",
};

function withCounts(all: string, entries: [string, number][]): SelectOption[] {
  return [{ value: "", label: all }, ...entries.map(([value, count]) => ({ value, label: `${value} (${count})` }))];
}

export function ListingFilters({ values, types, zones }: { values: FilterValues; types: [string, number][]; zones: [string, number][] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function navigate(next: FilterValues) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && key !== "pag") params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  const update = (key: string, value: string) => navigate({ ...values, [key]: value || undefined });

  function applySheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: FilterValues = { ...values };
    for (const key of ["tipo", "zona", "amb", "dorm", "moneda", "min", "max", "sup", "orden"]) {
      next[key] = String(data.get(key) ?? "").trim() || undefined;
    }
    navigate(next);
    setOpen(false);
  }

  const active = Object.keys(LABELS).filter((key) => values[key]);
  const typeOptions = withCounts("Todos", types);
  const zoneOptions = withCounts("Todas", zones);

  return (
    <div className="jw-filters" data-pending={pending}>
      <div className="jw-filters-bar">
        <div className="jw-seg" role="group" aria-label="Operación">
          {[["", "Todas"], ["venta", "Venta"], ["alquiler", "Alquiler"]].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={(values.op ?? "") === value} onClick={() => update("op", value)}>{label}</button>
          ))}
        </div>
        <div className="jw-filters-inline">
          <Select variant="bar" label="Tipo" value={values.tipo ?? ""} options={typeOptions} onChange={(value) => update("tipo", value)} />
          <Select variant="bar" label="Zona" value={values.zona ?? ""} options={zoneOptions} onChange={(value) => update("zona", value)} />
          <Select variant="bar" label="Ambientes" value={values.amb ?? ""} options={[{ value: "", label: "Todos" }, ...ROOMS]} onChange={(value) => update("amb", value)} />
        </div>
        <button type="button" className="jw-more" onClick={() => { setOpen(true); track("filters_open"); }}>
          <IconFilters width={18} height={18} /> Filtros
          {active.length > 0 && <span className="jw-more-count">{active.length}</span>}
        </button>
        <div className="jw-sort">
          <Select variant="bar" label="Ordenar" value={values.orden ?? ""} options={ORDER} onChange={(value) => update("orden", value)} />
        </div>
      </div>

      {active.length > 0 && (
        <ul className="jw-chips" aria-label="Filtros activos">
          {active.map((key) => (
            <li key={key}>
              <button type="button" onClick={() => update(key, "")} aria-label={`Quitar filtro ${LABELS[key](values[key] as string)}`}>
                {LABELS[key](values[key] as string)} <IconClose width={14} height={14} />
              </button>
            </li>
          ))}
          <li><button type="button" className="jw-chip-clear" onClick={() => navigate(values.op ? { op: values.op } : {})}>Limpiar</button></li>
        </ul>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        onSubmit={applySheet}
        footer={<button type="submit" className="jw-btn jw-btn-primary">Ver resultados</button>}
      >
        <div className="jw-group">
          <Select name="orden" label="Ordenar por" defaultValue={values.orden ?? ""} options={ORDER} />
          <Select name="tipo" label="Tipo" defaultValue={values.tipo ?? ""} options={typeOptions} />
          <Select name="zona" label="Zona" defaultValue={values.zona ?? ""} options={zoneOptions} />
          <Select name="amb" label="Ambientes" defaultValue={values.amb ?? ""} options={[{ value: "", label: "Todos" }, ...ROOMS]} />
          <Select name="dorm" label="Dormitorios" defaultValue={values.dorm ?? ""} options={[{ value: "", label: "Todos" }, ...[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} o más` }))]} />
        </div>
        <fieldset className="jw-sheet-section">
          <legend>Precio</legend>
          <div className="jw-group">
            <Select name="moneda" label="Moneda" defaultValue={values.moneda ?? ""} options={[{ value: "", label: "Cualquiera" }, { value: "USD", label: "Dólares" }, { value: "ARS", label: "Pesos" }]} />
            <label className="jw-group-input"><span>Desde</span><input name="min" inputMode="numeric" pattern="[0-9]*" placeholder="Sin mínimo" defaultValue={values.min ?? ""} /></label>
            <label className="jw-group-input"><span>Hasta</span><input name="max" inputMode="numeric" pattern="[0-9]*" placeholder="Sin máximo" defaultValue={values.max ?? ""} /></label>
          </div>
        </fieldset>
        <div className="jw-group">
          <label className="jw-group-input"><span>Superficie mínima</span><input name="sup" inputMode="numeric" pattern="[0-9]*" placeholder="m²" defaultValue={values.sup ?? ""} /></label>
        </div>
      </Sheet>
    </div>
  );
}
