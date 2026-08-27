"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { Spinner } from "../../_components/spinner";
import { formatDateTime as fmtDateTime } from "@/lib/datetime";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { MediaUploader, AttachmentPreview, type NoteAttachment } from "@/components/notes/media-uploader";
import { useNoteSignedUrls } from "@/components/notes/use-signed-urls";

interface UserOption {
  id: string;
  email: string;
  fullName: string | null;
}

interface RecentContactItem {
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
}

interface FollowUpItem {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  recentContact: RecentContactItem;
  assignedToUser: UserOption | null;
  assignedByUser: UserOption | null;
  _count: { actions: number; statusChanges: number };
}

interface FollowUpAction {
  id: string;
  type: string;
  description: string;
  audioUrl: string | null;
  attachments: NoteAttachment[] | null;
  actionAt: string;
  createdAt: string;
  createdByUser: UserOption | null;
}

interface StatusChange {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string;
  createdAt: string;
  changedByUser: UserOption | null;
}

interface FollowUpDetail extends Omit<FollowUpItem, "_count"> {
  actions: FollowUpAction[];
  statusChanges: StatusChange[];
}

interface Props {
  isAdmin: boolean;
  items: FollowUpItem[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  filters: { q: string; status: string; assignedToUserId: string };
  assignableUsers: UserOption[];
}

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "iniciada", label: "Iniciada" },
  { value: "activa", label: "Activa" },
  { value: "cerrada", label: "Cerrada" },
];

const ACTION_TYPES = [
  { value: "nota", label: "Nota" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "llamada", label: "Llamada" },
  { value: "audio", label: "Audio" },
  { value: "sin_respuesta", label: "Sin respuesta" },
  { value: "otro", label: "Otro" },
];

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try { return fmtDateTime(value); } catch { return "—"; }
}

function userLabel(user: UserOption | null | undefined) {
  if (!user) return "—";
  return user.fullName?.trim() || user.email;
}

export function ConsultantsFollowUpsClient({
  isAdmin,
  items,
  page,
  totalPages,
  total,
  limit,
  filters,
  assignableUsers,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(filters.q);
  const [status, setStatus] = useState(filters.status);
  const [assignedToUserId, setAssignedToUserId] = useState(filters.assignedToUserId);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<FollowUpDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
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

  const activeFilters = useMemo(() => {
    const responsable = assignedToUserId
      ? assignableUsers.find((u) => u.id === assignedToUserId)
      : null;
    return [
      q && `Búsqueda: ${q}`,
      status && `Estado: ${status}`,
      responsable && `Responsable: ${userLabel(responsable)}`,
    ].filter(Boolean) as string[];
  }, [q, status, assignedToUserId, assignableUsers]);

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      const clean = value.trim();
      if (clean) params.set(key, clean);
      else params.delete(key);
    };
    setOrDelete("q", q);
    setOrDelete("status", status);
    setOrDelete("assignedToUserId", isAdmin ? assignedToUserId : "");
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function resetFilters() {
    setQ("");
    setStatus("");
    setAssignedToUserId("");
    router.push(pathname);
  }

  async function loadDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/consultants-followups/${id}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo cargar el seguimiento");
        return;
      }
      setSelectedId(id);
      setDetail(body.data as FollowUpDetail);
      setDetailOpen(true);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleStatusChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    const form = new FormData(e.currentTarget);
    const nextStatus = String(form.get("status") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/consultants-followups/${selectedId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo actualizar el estado");
        return;
      }
      toast.success("Estado actualizado");
      await loadDetail(selectedId);
      router.refresh();
      (e.currentTarget as HTMLFormElement).reset();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleAddAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    const form = new FormData(e.currentTarget);
    const type = String(form.get("type") ?? "nota");
    const description = String(form.get("description") ?? "").trim();
    const actionAt = String(form.get("actionAt") ?? "").trim();
    if (!description && actionAttachments.length === 0) {
      toast.error("Agregá una descripción o un audio/adjunto");
      return;
    }
    const formEl = e.currentTarget;
    setSavingAction(true);
    try {
      const res = await fetch(`/api/consultants-followups/${selectedId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description, actionAt, attachments: actionAttachments }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo registrar la acción");
        return;
      }
      toast.success("Acción registrada");
      setActionAttachments([]);
      await loadDetail(selectedId);
      router.refresh();
      formEl.reset();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleMetaUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    const form = new FormData(e.currentTarget);
    const notes = String(form.get("notes") ?? "").trim();
    const assignedToUserId = String(form.get("assignedToUserId") ?? "").trim();
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/consultants-followups/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          ...(isAdmin ? { assignedToUserId: assignedToUserId || null } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo guardar");
        return;
      }
      toast.success("Seguimiento actualizado");
      await loadDetail(selectedId);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingMeta(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-text">Seguimientos de consultas</h1>
        <p className="text-sm text-text-muted">
          {total} seguimiento{total !== 1 ? "s" : ""} · Estados: pendiente, iniciada, activa, cerrada
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface/30 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono..."
            className="min-w-0 flex-1 basis-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none sm:basis-auto"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isAdmin && (
            <select
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
            >
              <option value="">Todos los responsables</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {userLabel(user)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => applyFilters(1)}
            className="rounded-xl bg-secondary/20 px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
          >
            Aplicar
          </button>
          <button
            onClick={resetFilters}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted transition-colors hover:bg-bg hover:text-text"
          >
            Limpiar
          </button>
        </div>
        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((chip) => (
              <span key={chip} className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-text-muted">
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface/30">
      {/* Cards — solo mobile */}
      <div className="sm:hidden space-y-2 p-3">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Sin resultados</p>
        ) : (
          items.map((item) => (
            <div key={item.id}
              className="cursor-pointer rounded-xl border border-border bg-surface/30 p-4 active:bg-surface/60"
              onClick={() => loadDetail(item.id)}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-all font-medium text-text">{item.recentContact.name}</p>
                <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] text-text flex-shrink-0">{item.status}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.recentContact.email && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.recentContact.email!); toast.success("Mail copiado"); }}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border/60 bg-bg px-3 text-xs text-text-muted active:bg-surface/80"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
                    <span className="max-w-[160px] truncate">{item.recentContact.email}</span>
                  </button>
                )}
                {(item.recentContact.cellphone || item.recentContact.phone) && (
                  <WhatsAppLink
                    phone={item.recentContact.cellphone ?? item.recentContact.phone}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border/60 bg-bg px-3 text-xs text-text-muted transition-colors hover:border-success/30 hover:text-success active:bg-surface/80"
                  >
                    {item.recentContact.cellphone ?? item.recentContact.phone}
                  </WhatsAppLink>
                )}
                {!item.recentContact.email && !item.recentContact.cellphone && !item.recentContact.phone && (
                  <span className="text-xs text-text-muted/50">Sin contacto</span>
                )}
              </div>
              <p className="mt-2 text-xs text-text-muted">{userLabel(item.assignedToUser)} · {formatDateTime(item.updatedAt)}</p>
            </div>
          ))
        )}
      </div>

      {/* Tabla ya existente — solo desktop */}
      <div className="hidden overflow-hidden sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-text-muted">
              <th className="px-5 py-3">Consulta</th>
              <th className="px-5 py-3">Estado</th>
              <th className="hidden px-5 py-3 md:table-cell">Responsable</th>
              <th className="hidden px-5 py-3 lg:table-cell">Actualizado</th>
              <th className="px-5 py-3 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-text-muted">
                  No hay seguimientos de consultas para los filtros seleccionados
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-border/50 last:border-b-0">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-text">{item.recentContact.name}</p>
                    <p className="text-xs text-text-muted">#{item.recentContact.externalId}</p>
                    {item.recentContact.email && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(item.recentContact.email!); toast.success("Mail copiado"); }}
                        className="block max-w-[200px] truncate text-xs text-text-muted/80 transition-colors hover:text-text active:opacity-60"
                      >
                        {item.recentContact.email}
                      </button>
                    )}
                    {(item.recentContact.cellphone || item.recentContact.phone) && (
                      <WhatsAppLink
                        phone={item.recentContact.cellphone ?? item.recentContact.phone}
                        className="flex max-w-[200px] items-center gap-1.5 truncate text-xs text-text-muted/80 transition-colors hover:text-success active:opacity-60"
                      >
                        {item.recentContact.cellphone ?? item.recentContact.phone}
                      </WhatsAppLink>
                    )}
                    {!item.recentContact.email && !item.recentContact.cellphone && !item.recentContact.phone && (
                      <p className="text-xs text-text-muted/50">Sin contacto</p>
                    )}
                    <p className="mt-0.5 text-xs text-text-muted/70 md:hidden">{userLabel(item.assignedToUser)}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-text">
                      {item.status}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3.5 text-text-muted md:table-cell">{userLabel(item.assignedToUser)}</td>
                  <td className="hidden px-5 py-3.5 text-text-muted lg:table-cell">{formatDateTime(item.updatedAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => loadDetail(item.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-bg"
                    >
                      {loadingDetail ? "Cargando..." : "Abrir"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      <Sheet
        open={detailOpen && !!detail}
        onClose={() => setDetailOpen(false)}
        title={detail?.recentContact?.name ?? "Detalle consulta"}
        maxWidth="sm:max-w-2xl"
      >
        {detail && (
          <div>
              <p className="mb-4 text-sm text-text-muted">
                {detail.recentContact.email ?? ((detail.recentContact.cellphone || detail.recentContact.phone) ? (
                  <WhatsAppLink
                    phone={detail.recentContact.cellphone ?? detail.recentContact.phone}
                    className="inline-flex items-center gap-1.5 align-middle transition-colors hover:text-success"
                  >
                    {detail.recentContact.cellphone ?? detail.recentContact.phone}
                  </WhatsAppLink>
                ) : "Sin dato")}
              </p>

              <div className="grid gap-5">
                <form onSubmit={handleMetaUpdate} className="rounded-xl border border-border bg-surface/30 p-4">
                  <p className="mb-3 text-sm font-medium text-text">Datos del seguimiento</p>
                  <div className="grid gap-3">
                    <textarea
                      name="notes"
                      defaultValue={detail.notes ?? ""}
                      placeholder="Notas generales del seguimiento..."
                      className="min-h-20 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                    {isAdmin && (
                      <select
                        name="assignedToUserId"
                        defaultValue={detail.assignedToUser?.id ?? ""}
                        className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
                      >
                        <option value="">Sin asignar</option>
                        {assignableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.fullName?.trim() || user.email}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="submit"
                      disabled={savingMeta}
                      className="rounded-xl border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-50"
                    >
                      {savingMeta ? <Spinner size={14} /> : "Guardar datos"}
                    </button>
                  </div>
                </form>

                <form onSubmit={handleStatusChange} className="rounded-xl border border-border bg-surface/30 p-4">
                  <p className="mb-3 text-sm font-medium text-text">Cambio de estado (nota obligatoria)</p>
                  <div className="grid gap-3">
                    <select
                      name="status"
                      defaultValue={detail.status}
                      className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      name="note"
                      required
                      placeholder="Explicá por qué cambia el estado..."
                      className="min-h-20 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={savingStatus}
                      className="rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50"
                    >
                      {savingStatus ? "Actualizando..." : "Actualizar estado"}
                    </button>
                  </div>
                </form>

                <form onSubmit={handleAddAction} className="rounded-xl border border-border bg-surface/30 p-4">
                  <p className="mb-3 text-sm font-medium text-text">Nueva acción</p>
                  <div className="grid gap-3">
                    <select
                      name="type"
                      defaultValue="nota"
                      className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
                    >
                      {ACTION_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      ref={actionDescriptionRef}
                      name="description"
                      placeholder="Ej: Comunicación por WhatsApp, en espera de respuesta..."
                      className="min-h-20 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                    <div className="rounded-xl border border-border bg-bg px-3 py-2.5">
                      <p className="mb-2 text-xs text-text-muted">Audio / adjuntos (el audio se transcribe al texto)</p>
                      <MediaUploader
                        attachments={actionAttachments}
                        onChange={setActionAttachments}
                        signedUrls={actionSignedUrls}
                        transcribe
                        onTranscription={appendActionTranscription}
                      />
                    </div>
                    <DateTimePicker name="actionAt" />
                    <button
                      type="submit"
                      disabled={savingAction}
                      className="rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50"
                    >
                      {savingAction ? "Guardando..." : "Registrar acción"}
                    </button>
                  </div>
                </form>

                <div className="rounded-xl border border-border bg-surface/30 p-4">
                  <p className="mb-3 text-sm font-medium text-text">Historial de estados</p>
                  <div className="space-y-2">
                    {detail.statusChanges.length === 0 ? (
                      <p className="text-sm text-text-muted">Sin cambios de estado</p>
                    ) : (
                      detail.statusChanges.map((change) => (
                        <div key={change.id} className="rounded-lg border border-border bg-bg/40 px-3 py-2">
                          <p className="text-sm text-text">
                            {change.fromStatus ?? "—"} → {change.toStatus}
                          </p>
                          <p className="text-xs text-text-muted">{change.note}</p>
                          <p className="text-xs text-text-muted/80">
                            {formatDateTime(change.createdAt)} · {userLabel(change.changedByUser)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface/30 p-4">
                  <p className="mb-3 text-sm font-medium text-text">Acciones registradas</p>
                  <div className="space-y-2">
                    {detail.actions.length === 0 ? (
                      <p className="text-sm text-text-muted">Sin acciones registradas</p>
                    ) : (
                      detail.actions.map((action) => (
                        <div key={action.id} className="rounded-lg border border-border bg-bg/40 px-3 py-2">
                          <p className="text-sm text-text">{action.type}</p>
                          {action.description && <p className="text-xs text-text-muted">{action.description}</p>}
                          {action.audioUrl && (
                            <a
                              href={action.audioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-secondary hover:underline"
                            >
                              Escuchar audio
                            </a>
                          )}
                          {Array.isArray(action.attachments) && action.attachments.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {action.attachments.map((att) => (
                                <AttachmentPreview key={att.path} attachment={att} url={actionSignedUrls[att.path]} />
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-text-muted/80">
                            {formatDateTime(action.actionAt)} · {userLabel(action.createdByUser)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

