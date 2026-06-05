"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "../../_components/spinner";
import { Pagination } from "../../_components/pagination";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/datetime";

interface ConsultantItem {
  id: string;
  tokkoContactId: number;
  name: string;
  email: string | null;
  phone: string | null;
  cellphone: string | null;
  leadStatus: string | null;
  agentName: string | null;
  agentEmail: string | null;
  tokkoCreatedAt: string | null;
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
  const [syncing, setSyncing] = useState(false);
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

  async function handleSync(mode: "auto" | "api") {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/tokko/contacts-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo sincronizar últimos contactos");
        return;
      }
      if (data.data?.noChanges) {
        toast.success("Últimos contactos al día. No hay nuevos registros.");
        router.refresh();
        return;
      }
      toast.success(
        `Últimos contactos sincronizados · nuevos: ${data.data?.created ?? 0}, actualizados: ${data.data?.updated ?? 0}`
      );
      router.refresh();
    } catch {
      toast.error("Error de conexión al sincronizar últimos contactos");
    } finally {
      setSyncing(false);
    }
  }

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
          <h1 className="font-display text-2xl font-medium text-text">Últimos contactos</h1>
          <p className="text-sm text-text-muted">
            Mostrando {items.length} de {total} resultado{total === 1 ? "" : "s"} · Total global: {totalAll}
          </p>
          <p className="text-xs text-text-muted/80">
            Última ejecución cron: {lastSyncRunAt ? formatDateTime(lastSyncRunAt) : "sin registros"}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleSync("auto")}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-50"
          >
            {syncing ? <Spinner size={14} /> : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
                <polyline points="21 3 21 8 16 8" />
              </svg>
            )}
            {syncing ? "Actualizando..." : "Actualizar últimos contactos"}
          </button>
        )}
      </div>

      {pendingRealtimeCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-2 text-sm">
          <p className="text-secondary">
            Hay {pendingRealtimeCount} contacto{pendingRealtimeCount === 1 ? "" : "s"} nuevo
            {pendingRealtimeCount === 1 ? "" : "s"} en tiempo real.
          </p>
          <button
            onClick={() => {
              setPendingRealtimeCount(0);
              toastShownRef.current = false;
              router.refresh();
            }}
            className="rounded-lg border border-secondary/50 px-3 py-1 text-secondary transition-colors hover:bg-secondary/15"
          >
            Actualizar lista
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface/30 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por nombre, email, teléfono..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
            />
          </div>

          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
          >
            <option value="">Todos los agentes</option>
            {agentOptions.map((agent) => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>

          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
          />

          <input
            type="date"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
          />

          <select
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value)}
            className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none scheme-dark"
          >
            <option value="created_desc">Más recientes</option>
            <option value="created_asc">Más antiguos</option>
            <option value="name_asc">Nombre A-Z</option>
            <option value="name_desc">Nombre Z-A</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyFilters(1)}
            className="rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
          >
            Aplicar filtros
          </button>
          <button
            onClick={resetFilters}
            className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-bg hover:text-text"
          >
            Limpiar filtros
          </button>
          {activeFilters.length > 0 && (
            <div className="ml-1 flex flex-wrap items-center gap-2">
              {activeFilters.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-text-muted"
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
          <p className="py-8 text-center text-sm text-text-muted">Sin resultados</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-surface/30 p-4">
              <p className="break-all font-medium text-text">{item.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.email && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(item.email!); toast.success("Mail copiado"); }}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border/60 bg-bg px-3 text-xs text-text-muted active:bg-surface/80"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
                    <span className="max-w-[160px] truncate">{item.email}</span>
                  </button>
                )}
                {(item.cellphone || item.phone) && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(item.cellphone ?? item.phone!); toast.success("Teléfono copiado"); }}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border/60 bg-bg px-3 text-xs text-text-muted active:bg-surface/80"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 016.19 15.9a19.79 19.79 0 01-3.07-8.67A2 2 0 015.11 5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 12.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                    {item.cellphone ?? item.phone}
                  </button>
                )}
                {!item.email && !item.cellphone && !item.phone && (
                  <span className="text-xs text-text-muted/50">Sin contacto</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                <span>{item.agentName ?? "—"}</span>
                <span>{formatDateTime24(item.tokkoCreatedAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tabla — solo desktop */}
      <div className="hidden sm:block overflow-hidden rounded-2xl border border-border bg-surface/30">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-text-muted">
              <th className="px-5 py-3">Contacto</th>
              <th className="hidden px-5 py-3 md:table-cell">Agente</th>
              <th className="hidden px-5 py-3 lg:table-cell">Creado</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center text-sm text-text-muted">
                  No hay últimos contactos para los filtros seleccionados
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border/50 last:border-b-0">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-text">{item.name}</p>
                    <p className="text-xs text-text-muted">#{item.tokkoContactId}</p>
                    {item.email && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(item.email!); toast.success("Mail copiado"); }}
                        className="block max-w-[200px] truncate text-xs text-text-muted/80 transition-colors hover:text-text active:opacity-60"
                      >
                        {item.email}
                      </button>
                    )}
                    {(item.cellphone || item.phone) && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(item.cellphone ?? item.phone!); toast.success("Teléfono copiado"); }}
                        className="block max-w-[200px] truncate text-xs text-text-muted/80 transition-colors hover:text-text active:opacity-60"
                      >
                        {item.cellphone ?? item.phone}
                      </button>
                    )}
                    {!item.email && !item.cellphone && !item.phone && (
                      <p className="text-xs text-text-muted/50">Sin contacto</p>
                    )}
                    <p className="mt-0.5 text-xs text-text-muted/70 md:hidden">{item.agentName ?? "—"}</p>
                  </td>
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    <p className="text-text-muted">{item.agentName ?? "—"}</p>
                    {item.agentEmail && (
                      <p className="text-xs text-text-muted/70">{item.agentEmail}</p>
                    )}
                  </td>
                  <td className="hidden px-5 py-3.5 text-text-muted lg:table-cell">
                    {formatDateTime24(item.tokkoCreatedAt)}
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
