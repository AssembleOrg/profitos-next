"use client";

import type { SearchRow, Slice } from "@/lib/web/server/insights";
import { SortableTable, type Column } from "./sortable-table";
import { BarList, EmptyState, Panel } from "./ui";

type Data = { searches: SearchRow[]; zeros: SearchRow[]; zones: Slice[]; types: Slice[]; rooms: Slice[] };

const COLUMNS: Column<SearchRow>[] = [
  { key: "signature", label: "Búsqueda", primary: true, value: (row) => row.signature },
  { key: "count", label: "Veces", numeric: true, value: (row) => row.count },
  { key: "people", label: "Personas", numeric: true, value: (row) => row.people },
  { key: "avgResults", label: "Resultados", numeric: true, value: (row) => row.avgResults, render: (row) => (row.zero ? <span className="font-medium text-danger">Sin resultados</span> : row.avgResults) },
];

export function SearchesTab({ data }: { data: Data }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Zonas más buscadas"><BarList items={data.zones} /></Panel>
        <Panel title="Tipos más buscados"><BarList items={data.types} /></Panel>
        <Panel title="Ambientes más buscados"><BarList items={data.rooms} /></Panel>
      </div>
      <Panel title="Sin resultados" subtitle="Lo que piden y hoy no está en la web: propiedades para salir a captar">
        {data.zeros.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {data.zeros.slice(0, 15).map((row) => (
              <li key={row.signature} className="flex items-baseline justify-between gap-3 py-2 text-[13.5px]">
                <span className="text-text">{row.signature}</span>
                <span className="whitespace-nowrap tabular-nums text-text-muted">{row.people} {row.people === 1 ? "persona" : "personas"}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Todas las búsquedas de este período dieron resultados.</EmptyState>}
      </Panel>
      <SortableTable
        rows={data.searches}
        columns={COLUMNS}
        rowKey={(row) => row.signature}
        searchText={(row) => row.signature}
        searchPlaceholder="Buscar en las búsquedas"
        initialSort="count"
        empty="Todavía no hay búsquedas con estos filtros."
      />
    </div>
  );
}
