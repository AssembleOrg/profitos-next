"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { formatDate as formatDateLib, formatDateTime as formatDateTimeLib } from "@/lib/datetime";
import { MediaUploader, AttachmentPreview, type NoteAttachment } from "@/components/notes/media-uploader";
import { useNoteSignedUrls } from "@/components/notes/use-signed-urls";

interface UserOption {
  id: string;
  fullName: string | null;
  email: string;
}

interface PropertyOption {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
}

interface FollowUpListItem {
  id: string;
  title: string | null;
  notes: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  property: PropertyOption;
  assignedToUser: UserOption;
  assignedByUser: UserOption;
  _count: { actions: number };
}

interface FollowUpAction {
  id: string;
  type: string;
  description: string;
  actionAt: string;
  shownToName: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  attachments: NoteAttachment[] | null;
  createdAt: string;
  createdByUser: UserOption;
}

interface FollowUpDetail extends FollowUpListItem {
  actions: FollowUpAction[];
}

interface Props {
  followUps: FollowUpListItem[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  assignableUsers: UserOption[];
  assignableProperties: PropertyOption[];
}

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente", color: "bg-warning" },
  { value: "en_progreso", label: "En progreso", color: "bg-info" },
  { value: "hecho", label: "Hecho", color: "bg-success" },
  { value: "cancelado", label: "Cancelado", color: "bg-danger" },
];

const ACTION_TYPES = [
  { value: "nota", label: "Nota" },
  { value: "visita", label: "Visita" },
  { value: "llamada", label: "Llamada" },
  { value: "mensaje", label: "Mensaje" },
  { value: "otro", label: "Otro" },
];

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try { return formatDateTimeLib(value); } catch { return "—"; }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return formatDateLib(value);
  } catch {
    return "—";
  }
}

function getStatusMeta(status: string) {
  return STATUS_OPTIONS.find((item) => item.value === status) ?? {
    value: status,
    label: status,
    color: "bg-text-muted",
  };
}

function userLabel(user: UserOption | null | undefined) {
  if (!user) return "—";
  return user.fullName?.trim() || user.email;
}

export function SeguimientosClient({
  followUps,
  page,
  totalPages,
  total,
  limit,
  isAdmin,
  assignableUsers,
  assignableProperties,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FollowUpDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [actionAttachments, setActionAttachments] = useState<NoteAttachment[]>([]);
  const actionDescriptionRef = useRef<HTMLTextAreaElement>(null);

  function appendActionTranscription(text: string) {
    const el = actionDescriptionRef.current;
    if (!el) return;
    el.value = el.value.trim() ? `${el.value.trim()}\n${text}` : text;
  }

  const actionAttachmentPaths = useMemo(() => {
    const paths: string[] = [];
    for (const a of detail?.actions ?? []) {
      if (Array.isArray(a.attachments)) for (const att of a.attachments) paths.push(att.path);
    }
    for (const att of actionAttachments) paths.push(att.path);
    return paths;
  }, [detail?.actions, actionAttachments]);
  const actionSignedUrls = useNoteSignedUrls(actionAttachmentPaths);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return followUps.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.title?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        item.property.address.toLowerCase().includes(q) ||
        userLabel(item.assignedToUser).toLowerCase().includes(q)
      );
    });
  }, [followUps, search, statusFilter]);

  async function loadDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/seguimientos/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo cargar el seguimiento");
        return;
      }
      setDetail(data.data as FollowUpDetail);
      setSelectedId(id);
      setDetailOpen(true);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetail(null);
    setSelectedId(null);
  }

  async function handleCreateFollowUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingFollowUp(true);

    const form = new FormData(e.currentTarget);
    const body = {
      propertyId: form.get("propertyId"),
      assignedToUserId: form.get("assignedToUserId"),
      title: form.get("title") || null,
      notes: form.get("notes") || null,
      status: form.get("status") || "pendiente",
      dueDate: form.get("dueDate") || null,
    };

    try {
      const res = await fetch("/api/seguimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo crear el seguimiento");
        return;
      }
      toast.success("Seguimiento creado");
      setCreateOpen(false);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function handleUpdateFollowUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingFollowUp(true);

    const form = new FormData(e.currentTarget);
    const body = {
      status: form.get("status") || undefined,
      notes: form.get("notes") || undefined,
      title: form.get("title") || undefined,
      dueDate: form.get("dueDate") || null,
      assignedToUserId: form.get("assignedToUserId") || undefined,
    };

    try {
      const res = await fetch(`/api/seguimientos/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo actualizar");
        return;
      }
      toast.success("Seguimiento actualizado");
      await loadDetail(selectedId);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function handleCreateAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingAction(true);

    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const body = {
      type: form.get("type") || "nota",
      description: form.get("description"),
      actionAt: form.get("actionAt") || null,
      shownToName: form.get("shownToName") || null,
      scheduledDate: form.get("scheduledDate") || null,
      scheduledTime: form.get("scheduledTime") || null,
      attachments: actionAttachments,
    };

    try {
      const res = await fetch(`/api/seguimientos/${selectedId}/acciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo registrar la acción");
        return;
      }
      toast.success("Acción registrada");
      formEl.reset();
      setActionAttachments([]);
      await loadDetail(selectedId);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingAction(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-text">Seguimientos</h1>
          <p className="text-sm text-text-muted">
            {total} seguimiento{total !== 1 ? "s" : ""} cargado{total !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo seguimiento
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Buscar por propiedad, responsable, título..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface/40 py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Cards — solo mobile */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Sin resultados</p>
        ) : (
          filtered.map((item) => {
            const status = getStatusMeta(item.status);
            return (
              <div key={item.id} onClick={() => loadDetail(item.id)}
                className="cursor-pointer rounded-xl border border-border bg-surface/30 p-4 active:bg-surface/60">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-text">{item.property.address}</p>
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border border-border">
                    <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{item.title?.trim() || "Sin título"}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                  <span>{userLabel(item.assignedToUser)}</span>
                  <span>Vence: {formatDate(item.dueDate)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabla — solo desktop */}
      <div className="hidden sm:block overflow-hidden rounded-2xl border border-border bg-surface/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-text-muted">
                <th className="px-5 py-3">Propiedad</th>
                <th className="px-5 py-3">Responsable</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Vence</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-text-muted">
                    {search || statusFilter ? "Sin resultados para los filtros seleccionados" : "No hay seguimientos cargados"}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const status = getStatusMeta(item.status);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => loadDetail(item.id)}
                      className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-surface/50"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-text">{item.property.address}</p>
                        <p className="text-xs text-text-muted">
                          {item.title?.trim() || "Sin título"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-text-muted">{userLabel(item.assignedToUser)}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
                          <span className="text-text-muted">{status.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-text-muted">{formatDate(item.dueDate)}</td>
                      <td className="px-5 py-3.5 text-right text-text-muted">{item._count.actions}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />


      <AnimatePresence>
        {createOpen && isAdmin && null}
      </AnimatePresence>

      {isAdmin && (
        <Sheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Nuevo seguimiento"
          maxWidth="sm:max-w-xl"
          footer={
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg px-4 py-2 text-sm text-text-muted active:text-text">Cancelar</button>
              <button type="submit" form="create-seguimiento-form" disabled={savingFollowUp} className="rounded-xl bg-secondary/20 px-5 py-2 text-sm font-medium text-secondary active:bg-secondary/30 disabled:opacity-50">
                {savingFollowUp ? "Guardando..." : "Crear seguimiento"}
              </button>
            </div>
          }
        >
          <form id="create-seguimiento-form" className="flex flex-col gap-4" onSubmit={handleCreateFollowUp}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Propiedad *</label>
                <select name="propertyId" required className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text focus:border-secondary focus:outline-none [color-scheme:light]">
                  <option value="">Seleccionar...</option>
                  {assignableProperties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Asignado a *</label>
                <select name="assignedToUserId" required className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text focus:border-secondary focus:outline-none [color-scheme:light]">
                  <option value="">Seleccionar...</option>
                  {assignableUsers.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Título</label>
                <input name="title" placeholder="Ej: Seguimiento comercial" className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-muted">Vencimiento</label>
                <DatePicker name="dueDate" className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text focus:border-secondary focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Estado</label>
              <select name="status" defaultValue="pendiente" className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text focus:border-secondary focus:outline-none [color-scheme:light]">
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Notas</label>
              <textarea name="notes" rows={3} className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
            </div>
          </form>
        </Sheet>
      )}

      <AnimatePresence>
        {detailOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
            onClick={closeDetail}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(event) => event.stopPropagation()}
              className="fixed bottom-0 left-0 right-0 max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-5 shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
            >
              {!detail || loadingDetail ? (
                <div className="flex min-h-[260px] items-center justify-center text-sm text-text-muted">
                  Cargando detalle...
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-text">{detail.property.address}</h2>
                      <p className="text-xs text-text-muted">
                        Actualizado: {formatDateTime(detail.updatedAt)}
                      </p>
                    </div>
                    <form className="flex flex-col gap-3 rounded-xl border border-border bg-bg/30 p-4" onSubmit={handleUpdateFollowUp}>
                      {isAdmin && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">Título</label>
                          <input name="title" defaultValue={detail.title ?? ""} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none" />
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">Estado</label>
                          <select name="status" defaultValue={detail.status} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]">
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">Vencimiento</label>
                          <DatePicker
                            name="dueDate"
                            defaultValue={detail.dueDate ? detail.dueDate.slice(0, 10) : ""}
                            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                          />
                        </div>
                      </div>

                      {isAdmin && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-muted">Responsable</label>
                          <select
                            name="assignedToUserId"
                            defaultValue={detail.assignedToUser.id}
                            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
                          >
                            {assignableUsers.map((option) => (
                              <option key={option.id} value={option.id}>
                                {userLabel(option)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-muted">Notas</label>
                        <textarea
                          name="notes"
                          defaultValue={detail.notes ?? ""}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                        />
                      </div>

                      <div className="mt-1 flex justify-end">
                        <button type="submit" disabled={savingFollowUp} className="rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50">
                          {savingFollowUp ? "Guardando..." : "Guardar cambios"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-border bg-bg/30 p-4">
                      <h3 className="mb-2 text-sm font-medium text-text">Nueva acción</h3>
                      <form className="flex flex-col gap-3" onSubmit={handleCreateAction}>
                        <div className="grid grid-cols-2 gap-3">
                          <select name="type" defaultValue="nota" className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]">
                            {ACTION_TYPES.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input name="shownToName" placeholder="Mostrado a..." className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />
                        </div>

                        <textarea ref={actionDescriptionRef} name="description" rows={3} placeholder="Detalle de la acción realizada..." className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none" />

                        <div className="rounded-lg border border-border bg-bg px-3 py-2.5">
                          <p className="mb-2 text-xs text-text-muted">Audio / adjuntos (el audio se transcribe al texto)</p>
                          <MediaUploader
                            attachments={actionAttachments}
                            onChange={setActionAttachments}
                            signedUrls={actionSignedUrls}
                            transcribe
                            onTranscription={appendActionTranscription}
                          />
                        </div>

                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-text-muted">Fecha y hora de la acción</label>
                            <DateTimePicker name="actionAt" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-text-muted">Próximo seguimiento</label>
                              <DatePicker name="scheduledDate" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none" />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-text-muted">Hora</label>
                              <TimePicker name="scheduledTime" defaultValue="09:00" />
                            </div>
                          </div>
                        </div>

                        <button type="submit" disabled={savingAction} className="mt-1 rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50">
                          {savingAction ? "Guardando acción..." : "Agregar acción"}
                        </button>
                      </form>
                    </div>

                    <div className="rounded-xl border border-border bg-bg/20 p-4">
                      <h3 className="mb-3 text-sm font-medium text-text">Auditoría</h3>
                      {detail.actions.length === 0 ? (
                        <p className="text-sm text-text-muted">Todavía no hay acciones registradas.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {detail.actions.map((action) => (
                            <div key={action.id} className="rounded-lg border border-border/60 bg-bg/40 p-3">
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[11px] font-medium text-secondary uppercase">
                                  {action.type}
                                </span>
                                <span className="text-xs text-text-muted">
                                  {formatDateTime(action.actionAt)}
                                </span>
                              </div>
                              {action.description && <p className="text-sm text-text">{action.description}</p>}
                              {Array.isArray(action.attachments) && action.attachments.length > 0 && (
                                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {action.attachments.map((att) => (
                                    <AttachmentPreview key={att.path} attachment={att} url={actionSignedUrls[att.path]} />
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                                {action.shownToName && <span>Mostrado a: {action.shownToName}</span>}
                                {action.scheduledDate && (
                                  <span>
                                    Próxima fecha: {formatDate(action.scheduledDate)} {action.scheduledTime ?? ""}
                                  </span>
                                )}
                                <span>Registró: {userLabel(action.createdByUser)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla → cards en mobile */}
    </div>
  );
}
