"use client";

import { useMemo, useState, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  label: string;
  value: (row: T) => number | string;
  render?: (row: T) => ReactNode;
  numeric?: boolean;
  /** Se muestra en la tarjeta del celular. */
  primary?: boolean;
};

/** Tabla en la computadora, tarjetas en el celular. Ordena por cualquier columna y busca por texto. */
export function SortableTable<T>({ rows, columns, rowKey, searchText, searchPlaceholder, initialSort, empty, filter }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText: (row: T) => string;
  searchPlaceholder: string;
  initialSort: string;
  empty: string;
  filter?: ReactNode;
}) {
  const [sort, setSort] = useState({ key: initialSort, desc: true });
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(25);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const column = columns.find((item) => item.key === sort.key) ?? columns[0];
    return rows
      .filter((row) => !term || searchText(row).toLowerCase().includes(term))
      .sort((a, b) => {
        const left = column.value(a);
        const right = column.value(b);
        const order = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "es");
        return sort.desc ? -order : order;
      });
  }, [columns, query, rows, searchText, sort]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-[16px] text-text outline-none focus:border-text md:w-72 md:text-[14px]"
        />
        {filter}
        <span className="ml-auto text-[12.5px] tabular-nums text-text-muted">{visible.length} {visible.length === 1 ? "resultado" : "resultados"}</span>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl bg-bg px-4 py-8 text-center text-[13.5px] text-text-muted">{empty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-border text-left">
                  {columns.map((column) => (
                    <th key={column.key} className={`whitespace-nowrap px-3 py-2.5 font-medium text-text-muted ${column.numeric ? "text-right" : ""}`} aria-sort={sort.key === column.key ? (sort.desc ? "descending" : "ascending") : "none"}>
                      <button type="button" className="hover:text-text" onClick={() => setSort((current) => ({ key: column.key, desc: current.key === column.key ? !current.desc : true }))}>
                        {column.label}{sort.key === column.key ? (sort.desc ? " ↓" : " ↑") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, limit).map((row) => (
                  <tr key={rowKey(row)} className="border-b border-border last:border-b-0 hover:bg-bg">
                    {columns.map((column) => (
                      <td key={column.key} className={`px-3 py-2.5 align-top text-text ${column.numeric ? "text-right tabular-nums" : ""}`}>{column.render ? column.render(row) : column.value(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {visible.slice(0, limit).map((row) => (
              <li key={rowKey(row)} className="rounded-2xl border border-border bg-surface p-4">
                {columns.filter((column) => column.primary).map((column) => <div key={column.key} className="mb-2 text-[14.5px] font-medium text-text">{column.render ? column.render(row) : column.value(row)}</div>)}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {columns.filter((column) => !column.primary).map((column) => (
                    <div key={column.key} className="flex items-baseline justify-between gap-2 text-[13px]">
                      <dt className="text-text-muted">{column.label}</dt>
                      <dd className="text-right tabular-nums text-text">{column.render ? column.render(row) : column.value(row)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          {visible.length > limit && (
            <button type="button" onClick={() => setLimit((value) => value + 25)} className="min-h-11 self-center rounded-xl border border-border-strong px-4 text-[13.5px] font-medium text-text hover:bg-surface-elevated">
              Ver más
            </button>
          )}
        </>
      )}
    </div>
  );
}
