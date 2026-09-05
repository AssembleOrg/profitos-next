"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { formatDate as formatDateLib, formatDateTime as formatDateTimeLib } from "@/lib/datetime";
import { MediaUploader, AttachmentPreview, type NoteAttachment } from "@/components/notes/media-uploader";
import { useNoteSignedUrls } from "@/components/notes/use-signed-urls";
import { SelectField } from "@/components/ui/select-field";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { firstPhone } from "@/lib/whatsapp";

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

interface ClientRef {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface FollowUpListItem {
  id: string;
  title: string | null;
  notes: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  property: PropertyOption & { coverImageUrl?: string | null };
  assignedToUser: UserOption;
  client: ClientRef | null;
  lastAction: { type: string; description: string; actionAt: string } | null;
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

interface FollowUpDetail extends Omit<FollowUpListItem, "lastAction" | "client"> {
  property: PropertyOption & {
    coverImageUrl: string | null;
    operationType: string | null;
    operationPrice: number | null;
    operationCurrency: string | null;
  };
  client: (ClientRef & { notes: string | null }) | null;
  actions: FollowUpAction[];
}

interface Props {
  followUps: FollowUpListItem[];
  statusCounts: Record<string, number>;
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isAdmin: boolean;
  assignableUsers: UserOption[];
  assignableProperties: PropertyOption[];
  filterQ: string;
  filterStatus: string;
  filterAssignee: string;
  filterVencidos: boolean;
}

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente", pill: "bg-sand-chip text-warning", hint: "Todavía no se contactó o no hubo avance." },
  { value: "en_progreso", label: "En progreso", pill: "bg-info-chip text-info", hint: "Hubo contacto y se está trabajando." },
  { value: "hecho", label: "Hecho", pill: "bg-sage-chip text-olive-light", hint: "Cerrado con resultado." },
  { value: "cancelado", label: "Cancelado", pill: "bg-clay-chip text-terra", hint: "Se desestimó." },
];

const ACTION_TYPES = [
  { value: "nota", label: "Nota" },
  { value: "visita", label: "Visita" },
  { value: "llamada", label: "Llamada" },
  { value: "mensaje", label: "Mensaje" },
  { value: "otro", label: "Otro" },
];

const ACTION_LABEL: Record<string, string> = Object.fromEntries([...ACTION_TYPES.map((a) => [a.value, a.label]), ["transferencia", "Transferencia"]]);

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try { return formatDateTimeLib(value); } catch { return "—"; }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try { return formatDateLib(value); } catch { return "—"; }
}

function isOverdue(item: { dueDate: string | null; status: string }) {
  return Boolean(item.dueDate) && !["hecho", "cancelado"].includes(item.status) && new Date(item.dueDate!) < new Date();
}

function getStatusMeta(status: string) {
  return STATUS_OPTIONS.find((item) => item.value === status) ?? { value: status, label: status, pill: "bg-bg text-text-faint", hint: "" };
}

function userLabel(user: UserOption | null | undefined) {
  if (!user) return "—";
  return user.fullName?.trim() || user.email;
}

function formatPrice(p: { operationType: string | null; operationPrice: number | null; operationCurrency: string | null }) {
  const parts: string[] = [];
  if (p.operationType) parts.push(p.operationType.charAt(0).toUpperCase() + p.operationType.slice(1));
  if (p.operationPrice) parts.push(`${p.operationCurrency ?? "USD"} ${Math.round(p.operationPrice).toLocaleString("es-AR")}`);
  return parts.join(" · ");
}

const inputCls = "h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none";
const labelCls = "mb-1 block text-[12.5px] font-semibold text-text-muted";
const chipBtn = "inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted transition-colors hover:bg-border/50 active:opacity-60";

/** Input con resultados remotos (clientes o propiedades). ponytail: fetch por tecla con debounce simple, sin lib. */
function SearchPicker<T extends { id: string }>({
  placeholder,
  url,
  render,
  onPick,
  autoFocus,
}: {
  placeholder: string;
  url: (q: string) => string;
  render: (item: T) => React.ReactNode;
  onPick: (item: T) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(url(q.trim()), { cache: "no-store" });
        const data = await res.json();
        setItems((data.data?.items ?? data.data ?? []) as T[]);
      } catch { setItems([]); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, url]);
  return (
    <div className="relative">
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className={inputCls} />
      {(items.length > 0 || loading) && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-[14px] border border-border bg-surface shadow-lg">
          {loading && items.length === 0 && <p className="px-3.5 py-2 text-[12px] text-text-faint">Buscando...</p>}
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => { onPick(item); setQ(""); setItems([]); }}
              className="block w-full px-3.5 py-2 text-left text-sm text-text hover:bg-bg">
              {render(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientContact({ client, compact }: { client: ClientRef; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-2"}`}>
      {client.phone && (
        <WhatsAppLink phone={client.phone} className="inline-flex max-w-fit items-center gap-1.5 rounded-full bg-sage-chip px-2.5 py-1 text-[11px] font-semibold text-olive-light transition-opacity hover:opacity-80 active:opacity-60">
          {compact ? "WhatsApp" : firstPhone(client.phone)}
        </WhatsAppLink>
      )}
      {client.email && !compact && (
        <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(client.email!); toast.success("Mail copiado"); }} className={`${chipBtn} max-w-[220px]`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>
          <span className="truncate">{client.email}</span>
        </button>
      )}
      {!client.phone && !client.email && <span className="text-[11px] text-text-faint">Sin datos de contacto</span>}
    </div>
  );
}

export function SeguimientosClient({
  followUps,
  statusCounts,
  page,
  totalPages,
  total,
  limit,
  isAdmin,
  assignableUsers,
  assignableProperties,
  filterQ,
  filterStatus,
  filterAssignee,
  filterVencidos,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FollowUpDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [actionAttachments, setActionAttachments] = useState<NoteAttachment[]>([]);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const actionDescriptionRef = useRef<HTMLTextAreaElement>(null);

  // Alta: cliente elegido / nuevo, propiedad elegida.
  const [createClient, setCreateClient] = useState<ClientRef | null>(null);
  const [createNewClient, setCreateNewClient] = useState(false);
  const [createProperty, setCreateProperty] = useState<PropertyOption | null>(null);

  // Detalle: edición inline del cliente / vincular cliente.
  const [editingClient, setEditingClient] = useState(false);
  const [linkingClient, setLinkingClient] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

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

  function pushFilter(key: "q" | "status" | "assignee" | "vencidos", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  async function loadDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailOpen(true);
    setLoadingDetail(true);
    setEditingClient(false);
    setLinkingClient(false);
    try {
      const res = await fetch(`/api/seguimientos/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo cargar el seguimiento");
        setDetailOpen(false);
        return;
      }
      setDetail(data.data as FollowUpDetail);
    } catch {
      toast.error("Error de conexión");
      setDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetail(null);
    setSelectedId(null);
  }

  async function patchFollowUp(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/seguimientos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "No se pudo actualizar");
    return data;
  }

  async function changeStatus(id: string, status: string) {
    setChangingStatus(id);
    try {
      await patchFollowUp(id, { status });
      toast.success(`Estado: ${getStatusMeta(status).label}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setChangingStatus(null);
    }
  }

  async function handleCreateFollowUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!createProperty) { toast.error("Elegí una propiedad"); return; }
    setSavingFollowUp(true);

    const form = new FormData(e.currentTarget);
    const body = {
      propertyId: createProperty.id,
      assignedToUserId: form.get("assignedToUserId"),
      clientId: createClient?.id ?? null,
      newClient: !createClient && createNewClient && form.get("clientName")
        ? { name: form.get("clientName"), phone: form.get("clientPhone") || null, email: form.get("clientEmail") || null }
        : null,
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
      setCreateClient(null);
      setCreateNewClient(false);
      setCreateProperty(null);
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
      await patchFollowUp(selectedId, body);
      toast.success("Seguimiento actualizado");
      await loadDetail(selectedId);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function handleLinkClient(client: ClientRef) {
    if (!selectedId) return;
    try {
      await patchFollowUp(selectedId, { clientId: client.id });
      toast.success(`Cliente vinculado: ${client.name}`);
      setLinkingClient(false);
      await loadDetail(selectedId);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de conexión");
    }
  }

  async function handleSaveClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail?.client || !selectedId) return;
    setSavingClient(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      notes: form.get("notes") || null,
    };
    try {
      const res = await fetch(`/api/clientes/${detail.client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? "No se pudo guardar el cliente"); return; }
      toast.success("Cliente actualizado");
      setEditingClient(false);
      await loadDetail(selectedId);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingClient(false);
    }
  }

  async function handleCreateAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setSavingAction(true);

    const form = new FormData(e.currentTarget);
    const body = {
      type: form.get("type") || "nota",
      description: form.get("description"),
      shownToName: form.get("shownToName") || null,
      actionAt: form.get("actionAt") || undefined,
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
      e.currentTarget.reset();
      setActionAttachments([]);
      await loadDetail(selectedId);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingAction(false);
    }
  }

  const hasFilters = Boolean(filterQ || filterStatus || filterAssignee || filterVencidos);
  const emptyMsg = hasFilters ? "Sin resultados para los filtros seleccionados" : "No hay seguimientos cargados";

  const counters = (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
      {STATUS_OPTIONS.map((s) => {
        const active = filterStatus === s.value;
        return (
          <button key={s.value} type="button" title={s.hint} onClick={() => pushFilter("status", active ? "" : s.value)}
            className={`flex shrink-0 items-center gap-2 rounded-[18px] border px-3.5 py-2 text-left transition-colors sm:flex-col sm:items-start sm:gap-0.5 sm:px-4 sm:py-3 ${s.pill} ${active ? "border-current" : "border-transparent hover:opacity-90"}`}>
            <span className="font-display text-[20px] font-semibold leading-none sm:text-[26px]">{statusCounts[s.value] ?? 0}</span>
            <span className="text-[11.5px] font-bold sm:text-[12.5px]">{s.label}</span>
          </button>
        );
      })}
    </div>
  );

  const statusSelect = (item: FollowUpListItem) => (
    <SelectField
      value={item.status}
      disabled={changingStatus === item.id}
      onChange={(e) => changeStatus(item.id, e.target.value)}
      className={`h-8 !rounded-full !border-0 !py-0 pl-3 pr-7 text-[11.5px] font-bold ${getStatusMeta(item.status).pill}`}
      wrapperClassName="w-auto"
    >
      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </SelectField>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Seguimientos</h1>
          <p className="text-[12.5px] text-text-faint">
            {total} seguimiento{total !== 1 ? "s" : ""}{hasFilters ? " (filtrados)" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:self-auto"
          >
            <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo seguimiento
          </button>
        )}
      </div>

      <div className={`flex flex-col gap-2.5 transition-opacity ${pending ? "opacity-70" : ""}`}>
        {counters}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por cliente, teléfono, propiedad, vendedor..."
              defaultValue={filterQ}
              onKeyDown={(e) => {
                if (e.key === "Enter") pushFilter("q", (e.target as HTMLInputElement).value);
              }}
              onBlur={(e) => {
                if (e.target.value !== filterQ) pushFilter("q", e.target.value);
              }}
              className="h-10 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <SelectField value={filterAssignee} onChange={(e) => pushFilter("assignee", e.target.value)} className="h-10 !rounded-full text-[12.5px]" wrapperClassName="w-auto">
                <option value="">Todos los vendedores</option>
                {assignableUsers.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
              </SelectField>
            )}
            <button type="button" onClick={() => pushFilter("vencidos", filterVencidos ? "" : "1")}
              className={`h-10 whitespace-nowrap rounded-full border px-4 text-[12.5px] font-bold transition-colors ${filterVencidos ? "border-danger bg-clay-chip text-danger" : "border-border bg-surface text-text-faint hover:text-text"}`}>
              Vencidos
            </button>
            {hasFilters && (
              <button type="button" onClick={() => startTransition(() => router.push(pathname))} className="px-2 text-[12.5px] font-semibold text-text-faint hover:text-text">
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards — solo mobile */}
      <div className="sm:hidden space-y-1.5">
        {followUps.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-text-faint">{emptyMsg}</p>
        ) : (
          followUps.map((item) => {
            const status = getStatusMeta(item.status);
            const location = [item.property.zone, item.property.city].filter(Boolean).join(" · ");
            const overdue = isOverdue(item);
            return (
              <div key={item.id} onClick={() => loadDetail(item.id)}
                className="cursor-pointer overflow-hidden rounded-[18px] border border-border bg-surface transition-colors active:bg-bg">
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-bold leading-tight text-text">{item.client?.name ?? item.property.address}</p>
                    {item.client && <ClientContact client={item.client} compact />}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-text-muted">
                    {item.client ? item.property.address : ""}{item.client && location ? " · " : ""}{location}
                  </p>
                  {item.lastAction ? (
                    <p className="mt-1.5 line-clamp-1 text-[12px] text-text-muted">
                      <span className="font-semibold">{ACTION_LABEL[item.lastAction.type] ?? item.lastAction.type}:</span> {item.lastAction.description}
                    </p>
                  ) : (
                    <p className="mt-1.5 line-clamp-1 text-[12px] text-text-muted">{item.title?.trim() || "Sin acciones"}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {userLabel(item.assignedToUser)}
                    </span>
                    {item.dueDate && (
                      <span className={`inline-flex items-center gap-1 ${overdue ? "font-bold text-danger" : ""}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {formatDate(item.dueDate)}
                      </span>
                    )}
                    {item._count.actions > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {item._count.actions}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[11.5px] font-bold ${status.pill}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {status.label}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tabla — solo desktop */}
      <div className="hidden sm:block overflow-hidden rounded-[20px] border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Propiedad</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Última acción</th>
                <th className="px-4 py-3">Vence</th>
              </tr>
            </thead>
            <tbody>
              {followUps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[12.5px] text-text-faint">{emptyMsg}</td>
                </tr>
              ) : (
                followUps.map((item) => {
                  const location = [item.property.zone, item.property.city].filter(Boolean).join(" · ");
                  const overdue = isOverdue(item);
                  return (
                    <tr key={item.id} onClick={() => loadDetail(item.id)} className="cursor-pointer border-t border-border transition-colors hover:bg-bg">
                      <td className="px-4 py-3">
                        {item.client ? (
                          <>
                            <p className="text-[13.5px] font-bold text-text">{item.client.name}</p>
                            <div className="mt-1"><ClientContact client={item.client} compact /></div>
                          </>
                        ) : (
                          <p className="text-[12.5px] text-text-faint">Sin cliente</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-bg">
                            {item.property.coverImageUrl && <Image src={item.property.coverImageUrl} alt="" fill sizes="40px" className="object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-text">{item.property.address}</p>
                            <p className="truncate text-[11.5px] text-text-faint">{location || item.title?.trim() || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-text-muted">{userLabel(item.assignedToUser)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>{statusSelect(item)}</td>
                      <td className="max-w-[260px] px-4 py-3">
                        {item.lastAction ? (
                          <>
                            <p className="line-clamp-1 text-[12.5px] text-text" title={item.lastAction.description}>{item.lastAction.description}</p>
                            <p className="text-[11px] text-text-faint">{ACTION_LABEL[item.lastAction.type] ?? item.lastAction.type} · {formatDateTime(item.lastAction.actionAt)}</p>
                          </>
                        ) : (
                          <p className="text-[12px] text-text-faint">—</p>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-[13px] ${overdue ? "font-bold text-danger" : "text-text-muted"}`}>{formatDate(item.dueDate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      {isAdmin && (
        <Sheet
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Nuevo seguimiento"
          maxWidth="sm:max-w-xl"
          footer={
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-2 text-[13px] font-semibold text-text-faint active:text-text">Cancelar</button>
              <button type="submit" form="create-seguimiento-form" disabled={savingFollowUp} className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50">
                {savingFollowUp ? "Guardando..." : "Crear seguimiento"}
              </button>
            </div>
          }
        >
          <form id="create-seguimiento-form" className="flex flex-col gap-4" onSubmit={handleCreateFollowUp}>
            <div className="rounded-[18px] bg-bg p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Cliente</p>
                {!createClient && (
                  <button type="button" onClick={() => setCreateNewClient((v) => !v)} className="text-[12px] font-semibold text-text-muted hover:text-text">
                    {createNewClient ? "Buscar existente" : "+ Nuevo cliente"}
                  </button>
                )}
              </div>
              {createClient ? (
                <div className="flex items-center justify-between gap-2 rounded-[14px] border border-border bg-surface px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-text">{createClient.name}</p>
                    <p className="text-[11.5px] text-text-faint">{[createClient.phone, createClient.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
                  </div>
                  <button type="button" onClick={() => setCreateClient(null)} className="text-[12px] font-semibold text-text-faint hover:text-text">Cambiar</button>
                </div>
              ) : createNewClient ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input name="clientName" placeholder="Nombre *" required className={inputCls} />
                  <input name="clientPhone" placeholder="Teléfono" className={inputCls} />
                  <input name="clientEmail" placeholder="Email" type="email" className={inputCls} />
                </div>
              ) : (
                <SearchPicker<ClientRef>
                  placeholder="Buscar por nombre, teléfono o email..."
                  url={(q) => `/api/clientes?q=${encodeURIComponent(q)}&limit=8`}
                  onPick={setCreateClient}
                  render={(c) => (
                    <>
                      <span className="font-semibold">{c.name}</span>
                      <span className="ml-2 text-[11.5px] text-text-faint">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                    </>
                  )}
                />
              )}
              <p className="mt-1.5 text-[11px] text-text-faint">Opcional. Se puede vincular después desde el detalle.</p>
            </div>

            <div className="rounded-[18px] bg-bg p-3.5">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Propiedad *</p>
              {createProperty ? (
                <div className="flex items-center justify-between gap-2 rounded-[14px] border border-border bg-surface px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-text">{createProperty.address}</p>
                    <p className="text-[11.5px] text-text-faint">{[createProperty.zone, createProperty.city].filter(Boolean).join(" · ")}</p>
                  </div>
                  <button type="button" onClick={() => setCreateProperty(null)} className="text-[12px] font-semibold text-text-faint hover:text-text">Cambiar</button>
                </div>
              ) : (
                <SearchPicker<PropertyOption>
                  placeholder="Buscar por dirección, zona o referencia..."
                  url={(q) => `/api/propiedades?q=${encodeURIComponent(q)}&limit=8`}
                  onPick={setCreateProperty}
                  render={(p) => (
                    <>
                      <span className="font-semibold">{p.address}</span>
                      <span className="ml-2 text-[11.5px] text-text-faint">{[p.zone, p.city].filter(Boolean).join(" · ")}</span>
                    </>
                  )}
                />
              )}
              {!createProperty && assignableProperties.length > 0 && (
                <SelectField wrapperClassName="mt-2 w-full" value="" onChange={(e) => setCreateProperty(assignableProperties.find((p) => p.id === e.target.value) ?? null)}>
                  <option value="">o elegir de las últimas cargadas...</option>
                  {assignableProperties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
                </SelectField>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Vendedor *</label>
                <SelectField name="assignedToUserId" required wrapperClassName="w-full">
                  <option value="">Seleccionar...</option>
                  {assignableUsers.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
                </SelectField>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <SelectField name="status" defaultValue="pendiente" wrapperClassName="w-full">
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectField>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Título</label>
                <input name="title" placeholder="Ej: Consulta por expensas" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Vencimiento</label>
                <DatePicker name="dueDate" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Notas</label>
              <textarea name="notes" rows={3} className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
            </div>
          </form>
        </Sheet>
      )}

      {detailOpen && (
        <Sheet
          open={detailOpen}
          onClose={closeDetail}
          title={detail ? [detail.client?.name, detail.property.address].filter(Boolean).join(" · ") : "Seguimiento"}
          maxWidth="sm:max-w-4xl"
        >
          {!detail || loadingDetail ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-[12.5px] text-text-faint">
              <svg className="animate-spin text-text-muted" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Cargando detalle...
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Cabecera: Cliente | Propiedad */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-border bg-surface p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Cliente</p>
                    {detail.client && !editingClient && (
                      <button type="button" onClick={() => setEditingClient(true)} className="text-[12px] font-semibold text-text-muted hover:text-text">Editar</button>
                    )}
                  </div>
                  {detail.client ? (
                    editingClient ? (
                      <form onSubmit={handleSaveClient} className="flex flex-col gap-2">
                        <input name="name" defaultValue={detail.client.name} required placeholder="Nombre" className={inputCls} />
                        <div className="grid grid-cols-2 gap-2">
                          <input name="phone" defaultValue={detail.client.phone ?? ""} placeholder="Teléfono" className={inputCls} />
                          <input name="email" defaultValue={detail.client.email ?? ""} placeholder="Email" type="email" className={inputCls} />
                        </div>
                        <textarea name="notes" defaultValue={detail.client.notes ?? ""} rows={2} placeholder="Notas del cliente" className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text focus:border-border-strong focus:outline-none" />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingClient(false)} className="px-2 text-[12.5px] font-semibold text-text-faint">Cancelar</button>
                          <button type="submit" disabled={savingClient} className="inline-flex h-9 items-center rounded-full bg-dark px-4 text-[12.5px] font-bold text-dark-fg disabled:opacity-50">
                            {savingClient ? "Guardando..." : "Guardar"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="font-display text-[18px] font-semibold text-text">{detail.client.name}</p>
                        <ClientContact client={detail.client} />
                        {detail.client.notes && <p className="mt-2 whitespace-pre-line text-[12.5px] text-text-muted">{detail.client.notes}</p>}
                      </>
                    )
                  ) : linkingClient ? (
                    <div className="flex flex-col gap-2">
                      <SearchPicker<ClientRef>
                        autoFocus
                        placeholder="Buscar cliente por nombre, teléfono o email..."
                        url={(q) => `/api/clientes?q=${encodeURIComponent(q)}&limit=8`}
                        onPick={handleLinkClient}
                        render={(c) => (
                          <>
                            <span className="font-semibold">{c.name}</span>
                            <span className="ml-2 text-[11.5px] text-text-faint">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                          </>
                        )}
                      />
                      <button type="button" onClick={() => setLinkingClient(false)} className="self-start px-1 text-[12px] font-semibold text-text-faint">Cancelar</button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[12.5px] text-text-faint">Sin cliente vinculado.</p>
                      <button type="button" onClick={() => setLinkingClient(true)} className="mt-2 inline-flex h-9 items-center rounded-full border border-border bg-surface px-4 text-[12.5px] font-semibold text-text-muted hover:bg-bg">
                        Vincular cliente
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 rounded-[18px] border border-border bg-surface p-4">
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[12px] bg-bg">
                    {detail.property.coverImageUrl && <Image src={detail.property.coverImageUrl} alt="" fill sizes="96px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Propiedad</p>
                    <p className="mt-1 font-display text-[16px] font-semibold leading-tight text-text">{detail.property.address}</p>
                    <p className="text-[12px] text-text-faint">{[detail.property.zone, detail.property.city].filter(Boolean).join(" · ")}</p>
                    {formatPrice(detail.property) && <p className="mt-1 text-[12.5px] font-semibold text-text-muted">{formatPrice(detail.property)}</p>}
                    <a href={`/propiedades?open=${detail.property.id}`} className="mt-1.5 inline-block text-[12px] font-semibold text-text-muted underline-offset-2 hover:underline">Ver propiedad →</a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-[11.5px] text-text-faint">Actualizado: {formatDateTime(detail.updatedAt)}</p>
                  </div>
                  <form className="flex flex-col gap-3 rounded-[18px] bg-bg p-4" onSubmit={handleUpdateFollowUp}>
                    {isAdmin && (
                      <div>
                        <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Título</label>
                        <input name="title" defaultValue={detail.title ?? ""} className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text focus:border-border-strong focus:outline-none" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Estado</label>
                        <SelectField name="status" defaultValue={detail.status} className="h-10" wrapperClassName="w-full">
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </SelectField>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Vencimiento</label>
                        <DatePicker
                          name="dueDate"
                          defaultValue={detail.dueDate ? detail.dueDate.slice(0, 10) : ""}
                          className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text focus:border-border-strong focus:outline-none"
                        />
                      </div>
                    </div>

                    {isAdmin && (
                      <div>
                        <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Vendedor</label>
                        <SelectField name="assignedToUserId" defaultValue={detail.assignedToUser.id} className="h-10" wrapperClassName="w-full">
                          {assignableUsers.map((option) => (
                            <option key={option.id} value={option.id}>{userLabel(option)}</option>
                          ))}
                        </SelectField>
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Notas del seguimiento</label>
                      <textarea
                        name="notes"
                        defaultValue={detail.notes ?? ""}
                        rows={3}
                        className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div className="mt-1 flex justify-end">
                      <button type="submit" disabled={savingFollowUp} className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg disabled:opacity-50">
                        {savingFollowUp ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </form>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[18px] bg-bg p-4">
                    <h3 className="mb-2 font-display text-base font-semibold text-text">Nueva acción</h3>
                    <form className="flex flex-col gap-3" onSubmit={handleCreateAction}>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField name="type" defaultValue="nota" className="h-10">
                          {ACTION_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </SelectField>
                        <input name="shownToName" placeholder="Mostrado a..." defaultValue={detail.client?.name ?? ""} className="rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />
                      </div>

                      <textarea ref={actionDescriptionRef} name="description" rows={3} placeholder="Detalle de la acción realizada..." className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none" />

                      <div className="rounded-[14px] border border-border bg-surface px-3.5 py-2.5">
                        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Audio / adjuntos (el audio se transcribe al texto)</p>
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
                          <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Fecha y hora de la acción</label>
                          <DateTimePicker name="actionAt" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Próximo seguimiento</label>
                            <DatePicker name="scheduledDate" className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text focus:border-border-strong focus:outline-none" />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Hora</label>
                            <TimePicker name="scheduledTime" defaultValue="09:00" />
                          </div>
                        </div>
                      </div>

                      <button type="submit" disabled={savingAction} className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50">
                        {savingAction ? "Guardando acción..." : "Agregar acción"}
                      </button>
                    </form>
                  </div>

                  <div className="rounded-[18px] border border-border bg-surface p-4">
                    <h3 className="mb-3 font-display text-base font-semibold text-text">Historial</h3>
                    {detail.actions.length === 0 ? (
                      <p className="text-[12.5px] text-text-faint">Todavía no hay acciones registradas.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {detail.actions.map((action) => (
                          <div key={action.id} className="rounded-[14px] bg-bg p-3">
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${action.type === "transferencia" ? "bg-info-chip text-info" : "bg-sand-chip text-warning"}`}>
                                {ACTION_LABEL[action.type] ?? action.type}
                              </span>
                              <span className="text-[11.5px] text-text-faint">{formatDateTime(action.actionAt)}</span>
                            </div>
                            {action.description && <p className="text-sm text-text">{action.description}</p>}
                            {Array.isArray(action.attachments) && action.attachments.length > 0 && (
                              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {action.attachments.map((att) => (
                                  <AttachmentPreview key={att.path} attachment={att} url={actionSignedUrls[att.path]} />
                                ))}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {action.shownToName && <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-muted">Mostrado a: {action.shownToName}</span>}
                              {action.scheduledDate && (
                                <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                                  Próxima fecha: {formatDate(action.scheduledDate)} {action.scheduledTime ?? ""}
                                </span>
                              )}
                              <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-faint">Registró: {userLabel(action.createdByUser)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
