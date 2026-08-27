"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { formatDate } from "@/lib/datetime";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { SelectField } from "@/components/ui/select-field";
import { MediaUploader, type NoteAttachment } from "@/components/notes/media-uploader";
import { useNoteSignedUrls } from "@/components/notes/use-signed-urls";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  attachments: NoteAttachment[] | null;
  createdAt: string;
  _count?: { visitas: number };
}

interface TokkoContact {
  id: string;
  externalId: number;
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
  externalCreatedAt: string | null;
  externalDeletedAt: string | null;
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
  "Activo": "bg-sage-chip text-olive-light",
  "Cerrado": "bg-clay-chip text-terra",
  "En espera": "bg-sand-chip text-warning",
  "Esperando respuesta": "bg-info-chip text-info",
  "Nuevo": "bg-sage-chip text-olive-light",
};

function getLeadStatusColor(status: string | null) {
  if (!status) return "bg-bg text-text-faint";
  return LEAD_STATUS_COLORS[status] ?? "bg-bg text-text-faint";
}

/** Tints alternados para avatares con iniciales. */
const AVATAR_TINTS = ["bg-sand-chip", "bg-sage-chip", "bg-clay-chip"];

/** Empty state V4: círculo tintado + título display + texto faint. */
function EmptyState({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div className="flex flex-col items-center rounded-[20px] bg-bg px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-chip">
        <svg className="text-accent" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 00-3-3.87" />
        </svg>
      </div>
      <p className="mt-3 font-display text-[15px] font-semibold text-text">{title}</p>
      <p className="mt-1 text-[12.5px] text-text-faint">{description}</p>
    </div>
  );
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
  const [clientAttachments, setClientAttachments] = useState<NoteAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tokko contact edit modal
  const [tokkoModalOpen, setTokkoModalOpen] = useState(false);
  const [editTokkoContact, setEditTokkoContact] = useState<TokkoContact | null>(null);
  const [tokkoLoading, setTokkoLoading] = useState(false);

  // Sync state

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
      const res = await fetch(`/api/contactos/${editTokkoContact.id}`, {
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

  useEffect(() => {
    if (modalOpen) setClientAttachments(editClient?.attachments ?? []);
  }, [modalOpen, editClient]);
  const clientSignedUrls = useNoteSignedUrls(clientAttachments.map((a) => a.path));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      phone: (form.get("phone") as string) || null,
      email: (form.get("email") as string) || null,
      notes: (form.get("notes") as string) || null,
      attachments: clientAttachments,
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
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Contactos</h1>
          <p className="text-[12.5px] text-text-faint">
            {total} resultado{total !== 1 ? "s" : ""}
            {totalAll != null && totalAll !== total && ` de ${totalAll} total`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "manual" && (
            <button
              onClick={handleNew}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 active:opacity-90"
            >
              <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-0.5 self-start rounded-full border border-border bg-surface p-1">
        <button
          onClick={() => switchTab("tokko")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] transition-colors ${
            tab === "tokko" ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
          }`}
        >
          Tokko
          {tab === "tokko" && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
              {totalAll ?? total}
            </span>
          )}
        </button>
        <button
          onClick={() => switchTab("manual")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] transition-colors ${
            tab === "manual" ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
          }`}
        >
          Manuales
          {tab === "manual" && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
              {totalAll ?? total}
            </span>
          )}
        </button>
      </div>

      {/* Filters — Tokko tab */}
      {tab === "tokko" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por nombre, email, teléfono..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          {leadStatusOptions.length > 0 && (
            <SelectField
              value={leadStatusFilter}
              onChange={(e) => setLeadStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {leadStatusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.value} ({s.count})
                </option>
              ))}
            </SelectField>
          )}
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted">
            <input
              type="checkbox"
              checked={hideDeleted}
              onChange={(e) => setHideDeleted(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
                hideDeleted ? "bg-dark" : "border border-border-strong bg-surface"
              }`}
            >
              {hideDeleted && (
                <svg className="text-accent" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            Ocultar eliminados
          </label>
          <button
            onClick={() => applyFilters(1)}
            className="inline-flex h-11 items-center justify-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
          >
            Buscar
          </button>
        </div>
      )}

      {/* Filters — Manual tab */}
      {tab === "manual" && (
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Buscar por nombre, teléfono, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
            className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />
        </div>
      )}

      {/* Tokko contacts list */}
      {tab === "tokko" && (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {tokkoContacts.length === 0 ? (
              <EmptyState
                title={filters.q || filters.leadStatus ? "Sin resultados" : "No hay contactos"}
                description={
                  filters.q || filters.leadStatus
                    ? "Probá ajustando la búsqueda o los filtros."
                    : "Aún no hay contactos importados."
                }
              />
            ) : (
              tokkoContacts.map((c) => (
                <div key={c.id} onClick={() => handleEditTokko(c)} className="cursor-pointer rounded-[18px] border border-border bg-surface p-3.5 active:bg-bg">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-text">{c.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.email && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.email!); toast.success("Mail copiado"); }}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-bg px-3.5 text-[12px] font-semibold text-text-muted active:bg-surface"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
                            <span className="max-w-[160px] truncate">{c.email}</span>
                          </button>
                        )}
                        {(c.cellphone || c.phone) && (
                          <WhatsAppLink
                            phone={c.cellphone ?? c.phone}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-sage-chip px-3.5 text-[12px] font-bold text-olive-light transition-opacity active:opacity-80"
                          >
                            {c.cellphone ?? c.phone}
                          </WhatsAppLink>
                        )}
                        {!c.email && !c.cellphone && !c.phone && (
                          <span className="text-[11.5px] text-text-faint">Sin contacto</span>
                        )}
                      </div>
                    </div>
                    {c.leadStatus && (
                      <span className={`ml-2 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getLeadStatusColor(c.leadStatus)}`}>
                        {c.leadStatus}
                      </span>
                    )}
                  </div>
                  {c.externalCreatedAt && (
                    <p className="mt-2 text-[11.5px] text-text-faint">{formatDate(c.externalCreatedAt)}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Nombre</th>
                  <th className="hidden px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint md:table-cell">Email</th>
                  <th className="hidden px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint lg:table-cell">Teléfono</th>
                  <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Estado</th>
                  <th className="hidden px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint lg:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {tokkoContacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6">
                      <EmptyState
                        title={filters.q || filters.leadStatus ? "Sin resultados" : "No hay contactos"}
                        description={
                          filters.q || filters.leadStatus
                            ? "Probá ajustando la búsqueda o los filtros."
                            : "Aún no hay contactos importados."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  tokkoContacts.map((c) => (
                    <tr key={c.id} onClick={() => handleEditTokko(c)} className="cursor-pointer border-t border-border transition-colors hover:bg-bg">
                      <td className="px-4 py-3.5">
                        <p className="text-[13.5px] font-bold text-text">{c.name}</p>
                        {c.externalDeletedAt && (
                          <p className="text-[10.5px] font-bold text-terra">Eliminado</p>
                        )}
                        <p className="mt-0.5 text-[11.5px] text-text-faint md:hidden">
                          {c.email ?? ((c.cellphone || c.phone) ? (
                            <WhatsAppLink
                              phone={c.cellphone ?? c.phone}
                              className="inline-flex items-center gap-1 align-middle transition-colors hover:text-success"
                            >
                              {c.cellphone ?? c.phone}
                            </WhatsAppLink>
                          ) : "—")}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3.5 text-[13px] text-text-muted md:table-cell">{c.email ?? "—"}</td>
                      <td className="hidden px-4 py-3.5 text-[13px] text-text-muted lg:table-cell">
                        <WhatsAppLink
                          phone={c.cellphone ?? c.phone}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-success"
                          fallback={<>—</>}
                        >
                          {c.cellphone ?? c.phone}
                        </WhatsAppLink>
                      </td>
                      <td className="px-4 py-3.5">
                        {c.leadStatus ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getLeadStatusColor(c.leadStatus)}`}>
                            {c.leadStatus}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="hidden px-4 py-3.5 text-[13px] text-text-muted lg:table-cell">
                        {c.externalCreatedAt ? formatDate(c.externalCreatedAt) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Manual clients grid */}
      {tab === "manual" && (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  title={filters.q ? "Sin resultados" : "No hay clientes"}
                  description={
                    filters.q
                      ? "Probá con otro nombre, teléfono o email."
                      : "Creá tu primer cliente manual para empezar."
                  }
                />
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
                  className="cursor-pointer rounded-[20px] border border-border bg-surface p-4 transition-colors hover:bg-bg active:bg-bg md:p-5"
                >
                  <div className="flex items-start gap-3">
                    <motion.div
                      layoutId={`contact-avatar-${c.id}`}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold text-text-muted ${AVATAR_TINTS[index % AVATAR_TINTS.length]}`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-text">{c.name}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {c.email && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.email!); toast.success("Mail copiado"); }}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-bg px-3.5 text-[12px] font-semibold text-text-muted active:bg-surface"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
                        <span className="max-w-[140px] truncate">{c.email}</span>
                      </button>
                    )}
                    {c.phone ? (
                      <WhatsAppLink
                        phone={c.phone}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-sage-chip px-3.5 text-[12px] font-bold text-olive-light transition-opacity active:opacity-80"
                      >
                        {c.phone}
                      </WhatsAppLink>
                    ) : (
                      !c.email && <span className="text-[11.5px] text-text-faint">Sin contacto</span>
                    )}
                    <span className="text-[11.5px] text-text-faint">
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
                className="flex h-10 items-center gap-1.5 rounded-full bg-clay-chip px-4 text-[13px] font-bold text-terra transition-opacity active:opacity-80 disabled:opacity-50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            ) : <div />}
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-[13px] font-semibold text-text-faint active:text-text">Cancelar</button>
              <button type="submit" form="client-form" disabled={loading}
                className="flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50">
                {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cliente"}
              </button>
            </div>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Nombre *</label>
            <input name="name" required defaultValue={editClient?.name ?? ""} placeholder="Juan Pérez"
              className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Teléfono</label>
              <input name="phone" defaultValue={editClient?.phone ?? ""} placeholder="+54 11 1234-5678"
                className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Email</label>
              <input name="email" type="email" defaultValue={editClient?.email ?? ""} placeholder="juan@email.com"
                className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Notas</label>
            <textarea name="notes" rows={3} defaultValue={editClient?.notes ?? ""} placeholder="Notas sobre el cliente..."
              className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Audio / adjuntos</label>
            <MediaUploader attachments={clientAttachments} onChange={setClientAttachments} signedUrls={clientSignedUrls} />
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
              <button type="button" onClick={handleCloseTokko} className="px-4 py-2 text-[13px] font-semibold text-text-faint active:text-text">Cancelar</button>
              <button type="submit" form="tokko-contact-form" disabled={tokkoLoading}
                className="flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50">
                {tokkoLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </>
        }
      >
        <form id="tokko-contact-form" onSubmit={handleSubmitTokko} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Nombre</label>
            <input name="name" defaultValue={editTokkoContact?.name ?? ""} placeholder="Nombre del contacto"
              className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Email</label>
              <input name="email" type="email" defaultValue={editTokkoContact?.email ?? ""} placeholder="email@ejemplo.com"
                className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Celular</label>
              <input name="cellphone" defaultValue={editTokkoContact?.cellphone ?? ""} placeholder="+54 11 1234-5678"
                className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Teléfono</label>
            <input name="phone" defaultValue={editTokkoContact?.phone ?? ""} placeholder="Teléfono fijo"
              className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
          </div>
          {/* Estado (leadStatus) oculto del modal — visible solo en tabla y filtro
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Estado</label>
            <input name="leadStatus" defaultValue={editTokkoContact?.leadStatus ?? ""} placeholder="Activo, Cerrado..."
              className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
          </div>
          */}
          {editTokkoContact?.externalCreatedAt && (
            <p className="text-[11.5px] text-text-faint">Creado: {formatDate(editTokkoContact.externalCreatedAt)}</p>
          )}
        </form>
      </Sheet>
    </div>
  );
}
