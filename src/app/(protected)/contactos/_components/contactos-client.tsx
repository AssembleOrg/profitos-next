"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { formatDate } from "@/lib/datetime";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { visitas: number };
}

interface TokkoContact {
  id: string;
  tokkoContactId: number;
  name: string;
  email: string | null;
  phone: string | null;
  cellphone: string | null;
  leadStatus: string | null;
  isCompany: boolean | null;
  isOwner: boolean | null;
  agentName: string | null;
  agentEmail: string | null;
  tags: string[];
  tokkoCreatedAt: string | null;
  tokkoDeletedAt: string | null;
  createdAt: string;
}

interface ContactosClientProps {
  tab: "tokko" | "manual";
  clients: Client[];
  tokkoContacts: TokkoContact[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  totalAll?: number;
  isAdmin: boolean;
  filters: { q: string; leadStatus: string; hideDeleted?: boolean };
  leadStatusOptions?: Array<{ value: string; count: number }>;
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  "Activo": "bg-emerald-500",
  "Cerrado": "bg-red-500",
  "En espera": "bg-amber-500",
  "Esperando respuesta": "bg-sky-500",
  "Nuevo": "bg-violet-500",
};

function getLeadStatusColor(status: string | null) {
  if (!status) return "bg-text-muted";
  return LEAD_STATUS_COLORS[status] ?? "bg-text-muted";
}

export function ContactosClient({
  tab,
  clients,
  tokkoContacts,
  page,
  totalPages,
  total,
  limit,
  totalAll,
  isAdmin,
  filters,
  leadStatusOptions = [],
}: ContactosClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(filters.q);
  const [leadStatusFilter, setLeadStatusFilter] = useState(filters.leadStatus);
  const [hideDeleted, setHideDeleted] = useState(filters.hideDeleted ?? false);

  // Manual client modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tokko contact edit modal
  const [tokkoModalOpen, setTokkoModalOpen] = useState(false);
  const [editTokkoContact, setEditTokkoContact] = useState<TokkoContact | null>(null);
  const [tokkoLoading, setTokkoLoading] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ offset: number; total: number } | null>(null);

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDel = (key: string, value: string) => {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    };
    setOrDel("q", query);
    setOrDel("leadStatus", leadStatusFilter);
    if (hideDeleted) params.set("hideDeleted", "true");
    else params.delete("hideDeleted");
    if (tab !== "tokko") params.set("tab", tab);
    else params.delete("tab");
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function switchTab(newTab: "tokko" | "manual") {
    const params = new URLSearchParams();
    if (newTab === "manual") params.set("tab", "manual");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  async function handleFullSync(reset = false) {
    setSyncing(true);
    setSyncProgress(null);
    let totalCreated = 0;
    let totalUpdated = 0;

    try {
      let done = false;
      while (!done) {
        const res = await fetch("/api/integrations/tokko/contacts-full-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reset: reset && totalCreated === 0 && totalUpdated === 0 }),
        });
        const body = await res.json();
        if (!res.ok) {
          toast.error(body.message ?? "Error en sincronización");
          break;
        }
        const data = body.data;
        totalCreated += data.created ?? 0;
        totalUpdated += data.updated ?? 0;
        setSyncProgress({ offset: data.offset, total: data.totalCount });
        done = data.done;
      }
      toast.success(`Sincronización completa: ${totalCreated} nuevos, ${totalUpdated} actualizados`);
      router.refresh();
    } catch {
      toast.error("Error de conexión durante sincronización");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  // Tokko contact handlers
  function handleEditTokko(c: TokkoContact) { setEditTokkoContact(c); setTokkoModalOpen(true); }
  function handleCloseTokko() { setTokkoModalOpen(false); setEditTokkoContact(null); }

  async function handleSubmitTokko(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTokkoContact) return;
    setTokkoLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: (form.get("name") as string) || undefined,
      email: (form.get("email") as string) || null,
      phone: (form.get("phone") as string) || null,
      cellphone: (form.get("cellphone") as string) || null,
      leadStatus: (form.get("leadStatus") as string) || null,
    };
    try {
      const res = await fetch(`/api/contactos-tokko/${editTokkoContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? "Error al guardar"); return; }
      toast.success("Contacto actualizado");
      handleCloseTokko();
      router.refresh();
    } catch { toast.error("Error de conexión"); }
    finally { setTokkoLoading(false); }
  }

  // Manual client handlers
  function handleNew() { setEditClient(null); setModalOpen(true); }
  function handleEdit(c: Client) { setEditClient(c); setModalOpen(true); }
  function handleClose() { setModalOpen(false); setEditClient(null); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      phone: (form.get("phone") as string) || null,
      email: (form.get("email") as string) || null,
      notes: (form.get("notes") as string) || null,
    };
    try {
      const url = editClient ? `/api/clientes/${editClient.id}` : "/api/clientes";
      const method = editClient ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? "Error al guardar"); return; }
      toast.success(editClient ? "Cliente actualizado" : "Cliente creado");
      handleClose();
      router.refresh();
    } catch { toast.error("Error de conexión"); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!editClient) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clientes/${editClient.id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); toast.error(data.message ?? "Error al eliminar"); return; }
      toast.success("Cliente eliminado");
      handleClose();
      router.refresh();
    } catch { toast.error("Error de conexión"); }
    finally { setDeleting(false); }
  }

  const isEdit = !!editClient;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-medium text-text">Contactos</h1>
          <p className="text-sm text-text-muted">
            {total} resultado{total !== 1 ? "s" : ""}
            {totalAll != null && totalAll !== total && ` de ${totalAll} total`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && tab === "tokko" && (
            <button
              onClick={() => handleFullSync(false)}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-muted active:bg-surface disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
                <polyline points="21 3 21 8 16 8" />
              </svg>
              {syncing ? (
                syncProgress
                  ? `${syncProgress.offset} / ${syncProgress.total}`
                  : "Sincronizando..."
              ) : "Sincronizar Tokko"}
            </button>
          )}
          {tab === "manual" && (
            <button
              onClick={handleNew}
              className="flex items-center gap-2 rounded-xl bg-secondary/20 px-3 py-2 text-sm font-medium text-secondary active:bg-secondary/30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface/30 p-1">
        <button
          onClick={() => switchTab("tokko")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "tokko" ? "bg-primary text-text" : "text-text-muted hover:text-text"
          }`}
        >
          Tokko
        </button>
        <button
          onClick={() => switchTab("manual")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "manual" ? "bg-primary text-text" : "text-text-muted hover:text-text"
          }`}
        >
          Manuales
        </button>
      </div>

      {/* Filters — Tokko tab */}
      {tab === "tokko" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por nombre, email, teléfono..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
              className="w-full rounded-xl border border-border bg-bg py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
            />
          </div>
          {leadStatusOptions.length > 0 && (
            <select
              value={leadStatusFilter}
              onChange={(e) => setLeadStatusFilter(e.target.value)}
              className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
            >
              <option value="">Todos los estados</option>
              {leadStatusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value} ({s.count})
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={hideDeleted}
              onChange={(e) => setHideDeleted(e.target.checked)}
              className="accent-secondary"
            />
            Ocultar eliminados
          </label>
          <button
            onClick={() => applyFilters(1)}
            className="rounded-xl bg-secondary/20 px-4 py-2.5 text-sm font-medium text-secondary hover:bg-secondary/30"
          >
            Buscar
          </button>
        </div>
      )}

      {/* Filters — Manual tab */}
      {tab === "manual" && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Buscar por nombre, teléfono, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
            className="w-full rounded-xl border border-border bg-surface/40 py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
          />
        </div>
      )}

      {/* Tokko contacts list */}
      {tab === "tokko" && (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {tokkoContacts.length === 0 ? (
              <div className="py-12 text-center text-sm text-text-muted">
                {filters.q || filters.leadStatus ? "Sin resultados" : "No hay contactos sincronizados"}
              </div>
            ) : (
              tokkoContacts.map((c) => (
                <div key={c.id} onClick={() => handleEditTokko(c)} className="cursor-pointer rounded-xl border border-border bg-surface/30 p-4 active:bg-surface/60">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{c.name}</p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {c.email ?? c.cellphone ?? c.phone ?? "Sin contacto"}
                      </p>
                    </div>
                    {c.leadStatus && (
                      <span className="ml-2 flex shrink-0 items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${getLeadStatusColor(c.leadStatus)}`} />
                        <span className="text-xs text-text-muted">{c.leadStatus}</span>
                      </span>
                    )}
                  </div>
                  {c.tokkoCreatedAt && (
                    <p className="mt-2 text-xs text-text-faint">{formatDate(c.tokkoCreatedAt)}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-surface/30 sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-text-muted">
                    <th className="px-5 py-3">Nombre</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Teléfono</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3">Fecha Tokko</th>
                  </tr>
                </thead>
                <tbody>
                  {tokkoContacts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-text-muted">
                        {filters.q || filters.leadStatus ? "Sin resultados para los filtros" : "No hay contactos sincronizados"}
                      </td>
                    </tr>
                  ) : (
                    tokkoContacts.map((c) => (
                      <tr key={c.id} onClick={() => handleEditTokko(c)} className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-surface/50">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-text">{c.name}</p>
                          {c.tokkoDeletedAt && (
                            <p className="text-[10px] text-red-400">Eliminado en Tokko</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-text-muted">{c.email ?? "—"}</td>
                        <td className="px-5 py-3.5 text-text-muted">{c.cellphone ?? c.phone ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          {c.leadStatus ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${getLeadStatusColor(c.leadStatus)}`} />
                              <span className="text-text-muted">{c.leadStatus}</span>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-text-muted">
                          {c.tokkoCreatedAt ? formatDate(c.tokkoCreatedAt) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Manual clients grid */}
      {tab === "manual" && (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-text-muted">
                {filters.q ? "Sin resultados para la búsqueda" : "No hay clientes registrados"}
              </div>
            ) : (
              clients.map((c, index) => (
                <motion.div
                  key={c.id}
                  layoutId={`contact-card-${c.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30, delay: index * 0.03 }}
                  whileTap={{ scale: 0.96, opacity: 0.8 }}
                  onClick={() => handleEdit(c)}
                  className="cursor-pointer rounded-2xl border border-border bg-surface/30 p-5"
                >
                  <div className="flex items-start gap-3">
                    <motion.div
                      layoutId={`contact-avatar-${c.id}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary"
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text">{c.name}</p>
                      {c.email && <p className="truncate text-xs text-text-muted">{c.email}</p>}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                    {c.phone ? (
                      <span className="flex items-center gap-1.5 text-xs text-text-muted">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                        </svg>
                        {c.phone}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted/50">Sin teléfono</span>
                    )}
                    <span className="text-xs text-text-muted">
                      {c._count?.visitas ?? 0} visita{(c._count?.visitas ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      {/* Manual client modal */}
      <Sheet
        open={modalOpen}
        onClose={handleClose}
        title={isEdit ? "Editar cliente" : "Nuevo cliente"}
        avatarInitial={editClient?.name.charAt(0).toUpperCase()}
        footer={
          <>
            {isEdit ? (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-400 active:bg-red-500/10 disabled:opacity-50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            ) : <div />}
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleClose} className="rounded-lg px-4 py-2 text-sm text-text-muted active:text-text">Cancelar</button>
              <button type="submit" form="client-form" disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-secondary/20 px-5 py-2 text-sm font-medium text-secondary active:bg-secondary/30 disabled:opacity-50">
                {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cliente"}
              </button>
            </div>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Nombre *</label>
            <input name="name" required defaultValue={editClient?.name ?? ""} placeholder="Juan Pérez"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Teléfono</label>
              <input name="phone" defaultValue={editClient?.phone ?? ""} placeholder="+54 11 1234-5678"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Email</label>
              <input name="email" type="email" defaultValue={editClient?.email ?? ""} placeholder="juan@email.com"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Notas</label>
            <textarea name="notes" rows={3} defaultValue={editClient?.notes ?? ""} placeholder="Notas sobre el cliente..."
              className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
          </div>
        </form>
      </Sheet>

      {/* Tokko contact edit modal */}
      <Sheet
        open={tokkoModalOpen}
        onClose={handleCloseTokko}
        title="Editar contacto"
        avatarInitial={editTokkoContact?.name.charAt(0).toUpperCase()}
        footer={
          <>
            <div />
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleCloseTokko} className="rounded-lg px-4 py-2 text-sm text-text-muted active:text-text">Cancelar</button>
              <button type="submit" form="tokko-contact-form" disabled={tokkoLoading}
                className="flex items-center gap-2 rounded-xl bg-secondary/20 px-5 py-2 text-sm font-medium text-secondary active:bg-secondary/30 disabled:opacity-50">
                {tokkoLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </>
        }
      >
        <form id="tokko-contact-form" onSubmit={handleSubmitTokko} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Nombre</label>
            <input name="name" defaultValue={editTokkoContact?.name ?? ""} placeholder="Nombre del contacto"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Email</label>
              <input name="email" type="email" defaultValue={editTokkoContact?.email ?? ""} placeholder="email@ejemplo.com"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Celular</label>
              <input name="cellphone" defaultValue={editTokkoContact?.cellphone ?? ""} placeholder="+54 11 1234-5678"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Teléfono</label>
              <input name="phone" defaultValue={editTokkoContact?.phone ?? ""} placeholder="Teléfono fijo"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Estado</label>
              <input name="leadStatus" defaultValue={editTokkoContact?.leadStatus ?? ""} placeholder="Activo, Cerrado..."
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
            </div>
          </div>
          {editTokkoContact?.tokkoCreatedAt && (
            <p className="text-xs text-text-faint">Creado en Tokko: {formatDate(editTokkoContact.tokkoCreatedAt)}</p>
          )}
        </form>
      </Sheet>
    </div>
  );
}
