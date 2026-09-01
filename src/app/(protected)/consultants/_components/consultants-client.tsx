"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { Pagination } from "../../_components/pagination";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { firstPhone } from "@/lib/whatsapp";
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

// Pestañas de estado de gestión (jp_contact_cases).
const ESTADOS: { key: string; label: string }[] = [
  { key: "nuevos", label: "Nuevos" },
  { key: "espera", label: "En espera" },
  { key: "tomados", label: "Tomados" },
  { key: "descartados", label: "Descartados" },
];

interface Props {
  items: InboxMessage[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  totalAll: number;
  counts: Record<InboxPortal, number>;
  filters: { q: string; portal: string; from: string; to: string; estado: string; mine: boolean };
  viewer: { userId: string; isAdmin: boolean };
  users: { id: string; fullName: string | null; email: string }[];
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: meta.dot }} aria-hidden />
      {meta.label}
      <span className="text-text-faint">· {KIND_LABEL[kind] ?? kind}</span>
    </span>
  );
}

function ContactChips({ item }: { item: InboxMessage }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
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
          {firstPhone(item.phone)}
        </WhatsAppLink>
      )}
      {!item.email && !item.phone && <span className="text-[11.5px] text-text-faint">Sin datos de contacto</span>}
    </div>
  );
}

/** Tarjeta de contacto (boceto: foto de la propiedad, título, mensaje, ✓ / ✗). */
function ContactCard({
  item,
  viewer,
  users,
  busy,
  onAction,
}: {
  item: InboxMessage;
  viewer: Props["viewer"];
  users: Props["users"];
  busy: string | null;
  onAction: (messageId: string, action: "take" | "wait" | "transfer", toUserId?: string) => void;
}) {
  const title = item.propertyAddress ?? item.propertyTitle ?? item.propertyRef ?? "Sin propiedad";
  const propHref = item.propertyId
    ? `/propiedades?${item.propertyAddress ? `q=${encodeURIComponent(item.propertyAddress)}&` : ""}open=${item.propertyId}`
    : null;
  const isBusy = busy === item.id;
  const canTransfer = item.caseStatus === "tomado" && (item.takenByUserId === viewer.userId || viewer.isAdmin);

  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface">
      {/* Foto de la propiedad */}
      <div className="relative aspect-[16/9] bg-bg">
        {item.coverImageUrl ? (
          <Image src={item.coverImageUrl} alt={title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-text-faint">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" />
            </svg>
          </div>
        )}
        <div className="absolute left-2 top-2"><PortalChip portal={item.portal} kind={item.kind} /></div>
        <span className="absolute right-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">
          {formatDateTime24(item.date)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        {/* Título: la propiedad */}
        {propHref ? (
          <Link href={propHref} className="line-clamp-1 text-[14px] font-bold text-text hover:underline">
            {title}
          </Link>
        ) : (
          <p className="line-clamp-1 text-[14px] font-bold text-text">{title}</p>
        )}

        {/* Contacto + mensaje */}
        <p className="mt-1 text-[13px] font-semibold text-text-muted">{item.name?.trim() || (item.portal === "mercadolibre" ? "Pregunta pública" : "Sin nombre")}</p>
        {item.message && <p className="mt-1 line-clamp-3 text-[12.5px] text-text-muted">“{item.message}”</p>}
        <ContactChips item={item} />

        {/* Estado / acciones */}
        <div className="mt-3 flex flex-1 items-end">
          {item.caseStatus === "tomado" ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <span className="rounded-full bg-sage-chip px-2.5 py-1 text-[11.5px] font-bold text-olive-light">
                Atiende: {item.takenByName ?? "—"}
              </span>
              {canTransfer && (
                <select
                  defaultValue=""
                  disabled={isBusy}
                  onChange={(e) => {
                    if (e.target.value) onAction(item.id, "transfer", e.target.value);
                    e.target.value = "";
                  }}
                  className="ml-auto max-w-[150px] rounded-full border border-border bg-surface px-2 py-1 text-[11.5px] font-semibold text-text-muted disabled:opacity-50"
                  aria-label="Transferir a"
                >
                  <option value="">Transferir a…</option>
                  {users
                    .filter((u) => u.id !== item.takenByUserId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName?.trim() || u.email}
                      </option>
                    ))}
                </select>
              )}
            </div>
          ) : item.caseStatus === "espera" ? (
            <div className="flex w-full items-center gap-2">
              <span className="rounded-full bg-sand-chip px-2.5 py-1 text-[11.5px] font-bold text-warning">En espera</span>
              <button
                onClick={() => onAction(item.id, "take")}
                disabled={isBusy}
                className="ml-auto rounded-full bg-dark px-3.5 py-1.5 text-[12px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isBusy ? "…" : "✓ Tomar igual"}
              </button>
            </div>
          ) : item.caseStatus === "descartado" ? (
            <span className="rounded-full bg-bg px-2.5 py-1 text-[11.5px] font-bold text-text-faint">Descartado</span>
          ) : (
            <div className="flex w-full items-center gap-2">
              <button
                onClick={() => onAction(item.id, "take")}
                disabled={isBusy}
                title="Lo tomo yo: crea/reusa el cliente y arma un seguimiento asignado a mí"
                className="flex-1 rounded-full bg-dark px-3.5 py-2 text-[12.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isBusy ? "Tomando…" : "✓ Tomar"}
              </button>
              <button
                onClick={() => onAction(item.id, "wait")}
                disabled={isBusy}
                title="Pasa a espera: si en 3 días nadie lo toma, se descarta solo"
                className="rounded-full border border-border bg-surface px-3.5 py-2 text-[12.5px] font-bold text-text-muted transition-colors hover:bg-bg disabled:opacity-50"
              >
                ✗ Espera
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConsultantsClient({ items, page, totalPages, total, limit, totalAll, counts, filters, viewer, users }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const [fromFilter, setFromFilter] = useState(filters.from);
  const [toFilter, setToFilter] = useState(filters.to);
  const [busy, setBusy] = useState<string | null>(null);

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

  async function doAction(messageId: string, action: "take" | "wait" | "transfer", toUserId?: string) {
    setBusy(messageId);
    try {
      const res = await fetch("/api/consultants/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, action, toUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "No se pudo aplicar");
      toast.success(body?.message ?? "Listo");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "", label: "Todos", count: totalAll },
    { key: "mercadolibre", label: "MercadoLibre", count: counts.mercadolibre },
    { key: "zonaprop", label: "ZonaProp", count: counts.zonaprop },
    { key: "argenprop", label: "ArgenProp", count: counts.argenprop },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Últimos contactos</h1>
          <p className="text-[12.5px] text-text-faint">
            Central de mensajes de MercadoLibre, ZonaProp y ArgenProp · Mostrando {items.length} de {total}
          </p>
        </div>
        {/* Mis contactos / Todos — para no-admin arranca en "Mis" */}
        <div className="flex rounded-full border border-border bg-surface p-1">
          {[
            { mine: true, label: "Mis contactos" },
            { mine: false, label: "Todos" },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => pushParams((p) => p.set("mine", t.mine ? "1" : "0"))}
              className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition-colors ${
                filters.mine === t.mine ? "bg-dark text-dark-fg" : "text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estado de gestión */}
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => {
          const active = filters.estado === e.key;
          return (
            <button
              key={e.key}
              onClick={() => pushParams((p) => p.set("estado", e.key))}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                active ? "bg-dark text-dark-fg" : "border border-border bg-surface text-text-muted hover:bg-bg"
              }`}
            >
              {e.label}
            </button>
          );
        })}
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

      {/* Grilla de tarjetas */}
      {items.length === 0 ? (
        <p className="py-10 text-center text-[12.5px] text-text-faint">
          {filters.estado === "nuevos" ? "No hay contactos nuevos 🎉" : "Sin resultados para los filtros"}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ContactCard key={item.id} item={item} viewer={viewer} users={users} busy={busy} onAction={doAction} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />
    </div>
  );
}
