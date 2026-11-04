"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import { SelectField } from "@/components/ui/select-field";
import { formatArgentinePhone } from "@/lib/web/phone";
import type { PersonRow } from "@/lib/web/server/insights";
import { SortableTable, type Column } from "./sortable-table";

const LEVEL_CLASS: Record<PersonRow["level"], string> = { Alto: "bg-text text-bg", Medio: "bg-surface-elevated text-text", Bajo: "text-text-muted" };

const COLUMNS: Column<PersonRow>[] = [
  {
    key: "name",
    label: "Persona",
    primary: true,
    value: (row) => row.name ?? row.email ?? "Anónimo",
    render: (row) => (
      <Link href={`/analitica-web/personas/${encodeURIComponent(row.id)}`} className="flex flex-col hover:underline">
        <span className="font-medium">{row.name ?? (row.registered ? row.email : `Anónimo ${row.id.slice(0, 6)}`)}</span>
        {row.registered && <span className="text-[12.5px] font-normal text-text-muted">{row.email}</span>}
      </Link>
    ),
  },
  {
    key: "phone",
    label: "Celular",
    value: (row) => row.phone ?? "",
    render: (row) => (row.phone ? <a className="underline underline-offset-2" href={`https://wa.me/${row.phone}`} target="_blank" rel="noreferrer">{formatArgentinePhone(row.phone)}</a> : <span className="text-text-faint">Sin dato</span>),
  },
  { key: "score", label: "Interés", numeric: true, value: (row) => row.score, render: (row) => <span className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-medium ${LEVEL_CLASS[row.level]}`}>{row.level} · {row.score}</span> },
  { key: "views", label: "Fichas", numeric: true, value: (row) => row.views },
  { key: "minutes", label: "Minutos", numeric: true, value: (row) => row.minutes },
  { key: "searches", label: "Búsquedas", numeric: true, value: (row) => row.searches },
  { key: "favorites", label: "Favoritas", numeric: true, value: (row) => row.favorites },
  { key: "contacts", label: "Consultas", numeric: true, value: (row) => row.contacts },
  { key: "sessions", label: "Sesiones", numeric: true, value: (row) => row.sessions },
  { key: "lastSeen", label: "Última vez", value: (row) => row.lastSeen, render: (row) => DateTime.fromISO(row.lastSeen).toFormat("dd/MM HH:mm") },
];

const VIEWS: Record<string, (row: PersonRow) => boolean> = {
  phone: (row) => Boolean(row.phone),
  contacted: (row) => row.contacts > 0,
  hot: (row) => row.level === "Alto",
  uncontacted: (row) => row.level !== "Bajo" && row.contacts === 0 && Boolean(row.phone),
  marketing: (row) => row.marketing,
};

export function PeopleTab({ rows }: { rows: PersonRow[] }) {
  const [view, setView] = useState("");
  const shown = useMemo(() => (VIEWS[view] ? rows.filter(VIEWS[view]) : rows), [rows, view]);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-text-muted">Interés: 1 punto por ficha y por minuto (hasta 30), 2 por volver, 5 por favorita y 15 por consulta. Medio desde 10, alto desde 30.</p>
      <SortableTable
        rows={shown}
        columns={COLUMNS}
        rowKey={(row) => `${row.id}-${row.registered}`}
        searchText={(row) => `${row.name ?? ""} ${row.email ?? ""} ${row.phone ?? ""}`}
        searchPlaceholder="Buscar nombre, email o celular"
        initialSort="score"
        empty="Todavía no hay personas con estos filtros."
        filter={
          <SelectField aria-label="Ver" value={view} onChange={(event) => setView(event.target.value)} wrapperClassName="w-full md:w-64">
            <option value="">Todas</option>
            <option value="hot">Interés alto</option>
            <option value="uncontacted">Interesadas con celular que no consultaron</option>
            <option value="phone">Con celular</option>
            <option value="contacted">Consultaron</option>
            <option value="marketing">Aceptaron novedades</option>
          </SelectField>
        }
      />
    </div>
  );
}
