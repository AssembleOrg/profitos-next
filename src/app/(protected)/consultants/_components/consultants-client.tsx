"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { Pagination } from "../../_components/pagination";
import { WhatsAppLink } from "@/components/whatsapp-link";
import type { InboxMessage, InboxPortal } from "@/lib/messages/inbox";

const PORTAL_META: Record<InboxPortal, { label: string; dot: string }> = {
  mercadolibre: { label: "MercadoLibre", dot: "#f2c94c" },
  zonaprop: { label: "ZonaProp", dot: "#7b61ff" },
  argenprop: { label: "ArgenProp", dot: "#e2574c" },
};

const KIND_LABEL: Record<string, string> = {
  mensajes: "Mensaje",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  contactados: "Contacto",
  pregunta: "Pregunta",
};

interface Props {
  items: InboxMessage[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  totalAll: number;
  counts: Record<InboxPortal, number>;
  filters: { q: string; portal: string; from: string; to: string };
}

function formatDateTime24(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

function PortalChip({ portal, kind }: { portal: InboxPortal; kind: string }) {
  const meta = PORTAL_META[portal];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted">
      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: meta.dot }} aria-hidden />
      {meta.label}
      <span className="text-text-faint">· {KIND_LABEL[kind] ?? kind}</span>
    </span>
  );
}

function ContactChips({ item }: { item: InboxMessage }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {item.email && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(item.email!);
            toast.success("Mail copiado");
          }}
          className="inline-flex max-w-[210px] items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted transition-colors hover:bg-border/50 active:opacity-60"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
          <span className="truncate">{item.email}</span>
        </button>
      )}
      {item.phone && (
        <WhatsAppLink
          phone={item.phone}
          className="inline-flex max-w-fit items-center gap-1.5 rounded-full bg-sage-chip px-2.5 py-1 text-[11px] font-semibold text-olive-light transition-opacity hover:opacity-80 active:opacity-60"
        >
          {item.phone}
        </WhatsAppLink>
      )}
      {!item.email && !item.phone && <span className="text-[11.5px] text-text-faint">Sin contacto</span>}
    </div>
  );
}

function Property({ item }: { item: InboxMessage }) {
  const label = item.propertyTitle || item.propertyRef;
  if (!label) return <span className="text-[11.5px] text-text-faint">—</span>;
  const body = (
    <span className="block max-w-[220px] truncate text-[12.5px] text-text-muted">
      {label}
      {item.price ? <span className="text-text-faint"> · {item.price}</span> : null}
    </span>
  );
  return item.propertyUrl ? (
    <a href={item.propertyUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      {body}
    </a>
  ) : (
    body
  );
}

export function ConsultantsClient({ items, page, totalPages, total, limit, totalAll, counts, filters }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const [fromFilter, setFromFilter] = useState(filters.from);
  const [toFilter, setToFilter] = useState(filters.to);

  function pushParams(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyFilters() {
    pushParams((params) => {
      const set = (k: string, v: string) => (v.trim() ? params.set(k, v.trim()) : params.delete(k));
      set("q", query);
      set("from", fromFilter);
      set("to", toFilter);
    });
  }

  function resetFilters() {
    setQuery("");
    setFromFilter("");
    setToFilter("");
    router.push(pathname);
  }

  function setPortal(portal: string) {
    pushParams((params) => (portal ? params.set("portal", portal) : params.delete("portal")));
  }

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "", label: "Todos", count: totalAll },
    { key: "mercadolibre", label: "MercadoLibre", count: counts.mercadolibre },
    { key: "zonaprop", label: "ZonaProp", count: counts.zonaprop },
    { key: "argenprop", label: "ArgenProp", count: counts.argenprop },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Últimos contactos</h1>
        <p className="text-[12.5px] text-text-faint">
          Central de mensajes de MercadoLibre, ZonaProp y ArgenProp · Mostrando {items.length} de {total}
        </p>
      </div>

      {/* Tabs por portal */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (filters.portal || "") === t.key;
          return (
            <button
              key={t.key || "all"}
              onClick={() => setPortal(t.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                active ? "bg-dark text-dark-fg" : "border border-border bg-surface text-text-muted hover:bg-bg"
              }`}
            >
              {t.key && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PORTAL_META[t.key as InboxPortal].dot }}
                  aria-hidden
                />
              )}
              {t.label}
              <span className={active ? "text-dark-fg/70" : "text-text-faint"}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="rounded-[20px] border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por nombre, email, teléfono, mensaje..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <DatePicker
            value={fromFilter}
            onChange={setFromFilter}
            aria-label="Desde"
            className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
          />
          <DatePicker
            value={toFilter}
            onChange={setToFilter}
            aria-label="Hasta"
            className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text focus:border-border-strong focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={applyFilters}
            className="inline-flex h-10 items-center rounded-full bg-dark px-4.5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
          >
            Aplicar filtros
          </button>
          <button
            onClick={resetFilters}
            className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Cards — mobile */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-text-faint">Sin resultados</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-[18px] border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between gap-2">
                <PortalChip portal={item.portal} kind={item.kind} />
                <span className="text-[11px] text-text-faint">{formatDateTime24(item.date)}</span>
              </div>
              <p className="mt-2 break-words text-[13.5px] font-bold text-text">{item.name ?? "Sin nombre"}</p>
              {item.message && (
                <p className="mt-1 line-clamp-3 text-[12.5px] text-text-muted">{item.message}</p>
              )}
              <ContactChips item={item} />
              <div className="mt-2">
                <Property item={item} />
              </div>
              {item.answered !== null && (
                <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${item.answered ? "bg-sage-chip text-olive-light" : "bg-sand-chip text-text-muted"}`}>
                  {item.answered ? "Respondida" : "Sin responder"}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Tabla — desktop */}
      <div className="hidden sm:block overflow-hidden rounded-[20px] border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
              <th className="px-4 py-3">Contacto / Mensaje</th>
              <th className="hidden px-4 py-3 md:table-cell">Portal</th>
              <th className="hidden px-4 py-3 lg:table-cell">Propiedad</th>
              <th className="hidden px-4 py-3 lg:table-cell">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-[12.5px] text-text-faint">
                  No hay mensajes para los filtros seleccionados
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border align-top last:border-b-0 hover:bg-bg">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-bold text-text">{item.name ?? "Sin nombre"}</p>
                      {item.answered !== null && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.answered ? "bg-sage-chip text-olive-light" : "bg-sand-chip text-text-muted"}`}>
                          {item.answered ? "Respondida" : "Sin responder"}
                        </span>
                      )}
                    </div>
                    {item.message && <p className="mt-0.5 line-clamp-2 max-w-[420px] text-[12px] text-text-muted">{item.message}</p>}
                    <ContactChips item={item} />
                    <div className="mt-1 md:hidden">
                      <PortalChip portal={item.portal} kind={item.kind} />
                    </div>
                  </td>
                  <td className="hidden px-4 py-3.5 md:table-cell">
                    <PortalChip portal={item.portal} kind={item.kind} />
                  </td>
                  <td className="hidden px-4 py-3.5 lg:table-cell">
                    <Property item={item} />
                  </td>
                  <td className="hidden px-4 py-3.5 text-[13px] text-text-muted lg:table-cell">
                    {formatDateTime24(item.date)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />
    </div>
  );
}
