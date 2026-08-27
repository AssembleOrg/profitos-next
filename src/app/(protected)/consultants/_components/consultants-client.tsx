"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectField } from "@/components/ui/select-field";
import { Pagination } from "../../_components/pagination";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/datetime";
import { WhatsAppLink } from "@/components/whatsapp-link";

interface ConsultantItem {
  id: string;
  externalId: number;
  name: string;
  email: string | null;
  phone: string | null;
  cellphone: string | null;
  leadStatus: string | null;
  agentName: string | null;
  agentEmail: string | null;
  externalCreatedAt: string | null;
  syncAt: string | null;
}

interface ConsultantsClientProps {
  isAdmin: boolean;
  currentUserEmail: string;
  items: ConsultantItem[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  totalAll: number;
  lastSyncRunAt: string | null;
  filters: {
    q: string;
    agent: string;
    from: string;
    to: string;
    sort: string;
  };
  agentOptions: string[];
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
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}:${ss}`;
}

export function ConsultantsClient({
  isAdmin,
  currentUserEmail,
  items,
  page,
  totalPages,
  total,
  limit,
  totalAll,
  lastSyncRunAt,
  filters,
  agentOptions,
}: Readonly<ConsultantsClientProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const [agentFilter, setAgentFilter] = useState(filters.agent);
  const [fromFilter, setFromFilter] = useState(filters.from);
  const [toFilter, setToFilter] = useState(filters.to);
  const [sortFilter, setSortFilter] = useState(filters.sort || "created_desc");
  const [pendingRealtimeCount, setPendingRealtimeCount] = useState(0);
  const toastShownRef = useRef(false);
  const userEmailNormalized = useMemo(() => currentUserEmail.trim().toLowerCase(), [currentUserEmail]);

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      const clean = value.trim();
      if (clean) params.set(key, clean);
      else params.delete(key);
    };

    setOrDelete("q", query);
    setOrDelete("agent", agentFilter);
    setOrDelete("from", fromFilter);
    setOrDelete("to", toFilter);
    setOrDelete("sort", sortFilter);

    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function resetFilters() {
    setQuery("");
    setAgentFilter("");
    setFromFilter("");
    setToFilter("");
    setSortFilter("created_desc");
    router.push(pathname);
  }

  const activeFilters = [
    query && `Búsqueda: ${query}`,
    agentFilter && `Agente: ${agentFilter}`,
    fromFilter && `Desde: ${fromFilter}`,
    toFilter && `Hasta: ${toFilter}`,
  ].filter(Boolean);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const channelKey = currentUserEmail.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
    const channel = supabase
      .channel(`recent-contacts-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: process.env.NEXT_PUBLIC_DB_SCHEMA ?? "profitos",
          table: "jp_ultimos_contactos",
        },
        (payload) => {
          const row = payload.new as {
            agent_email?: string | null;
            name?: string | null;
            lead_status?: string | null;
          };
          const agentEmail = (row.agent_email ?? "").trim().toLowerCase();
          const isAssignedToCurrentUser = !!agentEmail && agentEmail === userEmailNormalized;

          if (!isAdmin && !isAssignedToCurrentUser) return;

          setPendingRealtimeCount((prev) => prev + 1);
          const contactName = row.name?.trim() || "Nuevo contacto";
          const leadStatus = row.lead_status?.trim();
          const extra = leadStatus ? ` · ${leadStatus}` : "";
          toast.info(`${contactName}${extra}`, {
            description: isAdmin
              ? "Nuevo contacto detectado por sincronización"
              : "Tenés un nuevo contacto asignado",
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserEmail, isAdmin, userEmailNormalized]);

  useEffect(() => {
    if (pendingRealtimeCount <= 0 || toastShownRef.current) return;
    toastShownRef.current = true;
    toast.message(`Nuevos contactos en tiempo real: ${pendingRealtimeCount}`, {
      action: {
        label: "Actualizar",
        onClick: () => {
          setPendingRealtimeCount(0);
          toastShownRef.current = false;
          router.refresh();
        },
      },
      onDismiss: () => {
        toastShownRef.current = false;
      },
    });
  }, [pendingRealtimeCount, router]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Últimos contactos</h1>
          <p className="text-[12.5px] text-text-faint">
            Mostrando {items.length} de {total} resultado{total === 1 ? "" : "s"} · Total global: {totalAll}
          </p>
          <p className="text-[11.5px] text-text-faint">
            Última ejecución cron: {lastSyncRunAt ? formatDateTime(lastSyncRunAt) : "sin registros"}
          </p>
        </div>
      </div>

      {pendingRealtimeCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-[16px] bg-sage-chip px-4 py-3 text-sm">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-olive-light">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-olive-light" aria-hidden />
            Hay {pendingRealtimeCount} contacto{pendingRealtimeCount === 1 ? "" : "s"} nuevo
            {pendingRealtimeCount === 1 ? "" : "s"} en tiempo real.
          </p>
          <button
            onClick={() => {
              setPendingRealtimeCount(0);
              toastShownRef.current = false;
              router.refresh();
            }}
            className="rounded-full bg-olive-light px-4 py-1.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Actualizar lista
          </button>
        </div>
      )}

      <div className="rounded-[20px] border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por nombre, email, teléfono..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>

          <SelectField
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="">Todos los agentes</option>
            {agentOptions.map((agent) => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </SelectField>

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

          <SelectField
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value)}
          >
            <option value="created_desc">Más recientes</option>
            <option value="created_asc">Más antiguos</option>
            <option value="name_asc">Nombre A-Z</option>
            <option value="name_desc">Nombre Z-A</option>
          </SelectField>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyFilters(1)}
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
          {activeFilters.length > 0 && (
            <div className="ml-1 flex flex-wrap items-center gap-2">
              {activeFilters.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-sand-chip px-3 py-1.5 text-[12px] font-semibold text-text-muted"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cards — solo mobile */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-text-faint">Sin resultados</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-[18px] border border-border bg-surface p-3.5">
              <p className="break-all text-[13.5px] font-bold text-text">{item.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.email && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(item.email!); toast.success("Mail copiado"); }}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-bg px-3.5 text-[12px] font-semibold text-text-muted active:bg-border/50"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
                    <span className="max-w-[160px] truncate">{item.email}</span>
                  </button>
                )}
                {(item.cellphone || item.phone) && (
                  <WhatsAppLink
                    phone={item.cellphone ?? item.phone}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-sage-chip px-3.5 text-[12px] font-semibold text-olive-light transition-opacity active:opacity-80"
                  >
                    {item.cellphone ?? item.phone}
                  </WhatsAppLink>
                )}
                {!item.email && !item.cellphone && !item.phone && (
                  <span className="text-[12px] text-text-faint">Sin contacto</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11.5px] text-text-faint">
                <span>{item.agentName ?? "—"}</span>
                <span>{formatDateTime24(item.externalCreatedAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tabla — solo desktop */}
      <div className="hidden sm:block overflow-hidden rounded-[20px] border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
              <th className="px-4 py-3">Contacto</th>
              <th className="hidden px-4 py-3 md:table-cell">Agente</th>
              <th className="hidden px-4 py-3 lg:table-cell">Creado</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-[12.5px] text-text-faint">
                  No hay últimos contactos para los filtros seleccionados
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-bg">
                  <td className="px-4 py-3.5">
                    <p className="text-[13.5px] font-bold text-text">{item.name}</p>
                    <p className="text-[11.5px] text-text-faint">#{item.externalId}</p>
                    {item.email && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(item.email!); toast.success("Mail copiado"); }}
                        className="mt-1 inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted transition-colors hover:bg-border/50 active:opacity-60"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
                        <span className="truncate">{item.email}</span>
                      </button>
                    )}
                    {(item.cellphone || item.phone) && (
                      <WhatsAppLink
                        phone={item.cellphone ?? item.phone}
                        className="mt-1 flex max-w-fit items-center gap-1.5 rounded-full bg-sage-chip px-2.5 py-1 text-[11px] font-semibold text-olive-light transition-opacity hover:opacity-80 active:opacity-60"
                      >
                        {item.cellphone ?? item.phone}
                      </WhatsAppLink>
                    )}
                    {!item.email && !item.cellphone && !item.phone && (
                      <p className="text-[11.5px] text-text-faint">Sin contacto</p>
                    )}
                    <p className="mt-0.5 text-[11.5px] text-text-faint md:hidden">{item.agentName ?? "—"}</p>
                  </td>
                  <td className="hidden px-4 py-3.5 md:table-cell">
                    <p className="text-[13px] text-text-muted">{item.agentName ?? "—"}</p>
                    {item.agentEmail && (
                      <p className="text-[11.5px] text-text-faint">{item.agentEmail}</p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3.5 text-[13px] text-text-muted lg:table-cell">
                    {formatDateTime24(item.externalCreatedAt)}
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
