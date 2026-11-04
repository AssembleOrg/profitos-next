"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PropertyRow } from "@/lib/web/server/insights";
import { SortableTable, type Column } from "./sortable-table";
import { formatDuration } from "./ui";

const columns = (query: string): Column<PropertyRow>[] => [
  {
    key: "address",
    label: "Propiedad",
    primary: true,
    value: (row) => row.address,
    render: (row) => (
      <span className="flex flex-col">
        <Link href={`/analitica-web/propiedades/${encodeURIComponent(row.key)}${query ? `?${query}` : ""}`} className="font-medium hover:underline">{row.address}</Link>
        <span className="text-[12.5px] font-normal text-text-muted">{[row.type, row.zone, row.operation].filter(Boolean).join(" · ")}</span>
      </span>
    ),
  },
  { key: "views", label: "Vistas", numeric: true, value: (row) => row.views },
  { key: "people", label: "Personas", numeric: true, value: (row) => row.people },
  { key: "avgSeconds", label: "Tiempo medio", numeric: true, value: (row) => row.avgSeconds, render: (row) => formatDuration(row.avgSeconds) },
  { key: "totalMinutes", label: "Minutos totales", numeric: true, value: (row) => row.totalMinutes },
  { key: "photos", label: "Fotos", numeric: true, value: (row) => row.photos },
  { key: "favorites", label: "Favoritas", numeric: true, value: (row) => row.favorites },
  { key: "contacts", label: "Consultas", numeric: true, value: (row) => row.contacts },
  { key: "conversion", label: "Consultan", numeric: true, value: (row) => row.conversion, render: (row) => `${Math.round(row.conversion * 100)}%` },
];

export function PropertiesTab({ rows }: { rows: PropertyRow[] }) {
  const params = new URLSearchParams(useSearchParams().toString());
  params.delete("tab");
  return (
    <SortableTable
      rows={rows}
      columns={columns(params.toString())}
      rowKey={(row) => row.key}
      searchText={(row) => `${row.address} ${row.type ?? ""} ${row.zone ?? ""} ${row.key}`}
      searchPlaceholder="Buscar dirección, tipo o zona"
      initialSort="views"
      empty="Todavía no hay fichas vistas con estos filtros."
    />
  );
}
