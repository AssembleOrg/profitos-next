"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatDate, formatRelative } from "@/lib/datetime";
import {
  SIGNATURE_DATE_META,
  SIGNATURE_STATUSES,
  SIGNATURE_STATUS_LABEL,
  SIGNATURE_STATUS_STYLE,
  type Attachment,
  type SignatureDateField,
  type SignatureStatus,
} from "@/lib/signatures";
import { AttachmentPreview, MediaUploader } from "./media-uploader";
import { useSignedUrls } from "./use-signed-urls";
import { DateField } from "../../_components/date-field";
import type { FirmaAction, SerializedFirma } from "./types";

interface FirmaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firma: SerializedFirma | null;
  currentUserId: string;
  isAdmin: boolean;
  onUpdated: (firma: SerializedFirma) => void;
  onDeleted: (id: string) => void;
}

export function FirmaDetailModal({
  open,
  onOpenChange,
  firma,
  currentUserId,
  isAdmin,
  onUpdated,
  onDeleted,
}: Readonly<FirmaDetailModalProps>) {
  if (!firma) return null;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[94dvh] w-[min(820px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl"
              >
                <DetailContent
                  firma={firma}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onUpdated={onUpdated}
                  onDeleted={(id) => {
                    onDeleted(id);
                    onOpenChange(false);
                  }}
                  onClose={() => onOpenChange(false)}
                />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

interface DetailContentProps {
  firma: SerializedFirma;
  currentUserId: string;
  isAdmin: boolean;
  onUpdated: (firma: SerializedFirma) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

function DetailContent({
  firma,
  currentUserId,
  isAdmin,
  onUpdated,
  onDeleted,
  onClose,
}: Readonly<DetailContentProps>) {
  const allPaths = useMemo(() => {
    const paths: string[] = [];
    for (const att of firma.attachments) paths.push(att.path);
    for (const action of firma.actions) {
      for (const att of action.attachments) paths.push(att.path);
    }
    return paths;
  }, [firma]);
  const signedUrls = useSignedUrls(allPaths);

  const statusStyle = SIGNATURE_STATUS_STYLE[firma.status];
  const canDelete = isAdmin || firma.createdByUser.id === currentUserId;

  async function handleDelete() {
    if (!confirm(`¿Eliminar esta propuesta? Esta acción es irreversible.`)) return;
    try {
      const res = await fetch(`/api/firmas/${firma.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success("Propuesta eliminada");
      onDeleted(firma.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <Dialog.Title className="line-clamp-1 font-display text-[18px] font-semibold text-text">
            {firma.property.address}
          </Dialog.Title>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-text-faint">
            {firma.property.zone && <span>{firma.property.zone}</span>}
            {firma.property.city && <span>· {firma.property.city}</span>}
            {firma.property.operationType && (
              <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                {firma.property.operationType}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle.chip}`}
          >
            {SIGNATURE_STATUS_LABEL[firma.status]}
          </span>
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-bg hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Dialog.Close>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-6">
          {/* Status & dates control panel */}
          <ControlPanel firma={firma} onUpdated={onUpdated} />

          {/* Original proposal data */}
          {(firma.title || firma.description || firma.attachments.length > 0) && (
            <section className="rounded-[16px] border border-border bg-surface p-4">
              <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
                Propuesta original
              </h4>
              {firma.title && (
                <p className="text-[14px] font-bold text-text">{firma.title}</p>
              )}
              {firma.description && (
                <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-muted">
                  {firma.description}
                </p>
              )}
              {firma.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {firma.attachments.map((att) => (
                    <AttachmentChip key={att.path} attachment={att} url={signedUrls[att.path]} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Timeline */}
          <section>
            <h4 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Línea de tiempo
            </h4>
            <Timeline
              actions={firma.actions}
              signedUrls={signedUrls}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onActionDeleted={(actionId) => {
                const next = {
                  ...firma,
                  actions: firma.actions.filter((a) => a.id !== actionId),
                };
                onUpdated(next);
              }}
              proposalId={firma.id}
            />
          </section>

          {/* Add note */}
          <AddNoteSection
            firmaId={firma.id}
            onAdded={(action) => {
              onUpdated({
                ...firma,
                actions: [action, ...firma.actions],
                updatedAt: action.createdAt,
              });
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3">
        <span className="text-[11.5px] text-text-faint">
          Creada por{" "}
          {firma.createdByUser.fullName?.trim() || firma.createdByUser.email.split("@")[0]} ·{" "}
          {formatRelative(firma.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-10 items-center rounded-full bg-clay-chip px-4 text-[13px] font-bold text-terra transition-opacity hover:opacity-90"
            >
              Eliminar propuesta
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text"
          >
            Cerrar
          </button>
        </div>
      </footer>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Control panel (status + datepickers)
// ──────────────────────────────────────────────────────────────────

interface ControlPanelProps {
  firma: SerializedFirma;
  onUpdated: (firma: SerializedFirma) => void;
}

function ControlPanel({ firma, onUpdated }: Readonly<ControlPanelProps>) {
  const [busy, setBusy] = useState(false);

  function dateValue(field: SignatureDateField): string {
    const raw = firma[field];
    return raw ? raw.slice(0, 10) : "";
  }

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/firmas/${firma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onUpdated(serializeFromApi(body.data));
      toast.success("Actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[16px] bg-bg p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
          Estado y fechas
        </h4>
        <select
          value={firma.status}
          disabled={busy}
          onChange={(e) => patch({ status: e.target.value })}
          className="h-10 appearance-none rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text focus:border-border-strong focus:outline-none disabled:opacity-60 [color-scheme:light]"
        >
          {SIGNATURE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SIGNATURE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["dateProcessStarted", "dateAgreed", "dateKeysHandover"] as SignatureDateField[]).map(
          (field) => {
            const meta = SIGNATURE_DATE_META[field];
            const value = dateValue(field);
            return (
              <label key={field} className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
                  {meta.label}
                </span>
                <DateField
                  value={value}
                  onChange={(iso) => patch({ [field]: iso || null })}
                  disabled={busy}
                />
              </label>
            );
          },
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-text-faint">
        <svg className="shrink-0 text-olive-light" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Cada fecha aparece automáticamente en la agenda de todo el equipo.
      </p>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Vertical timeline of actions
// ──────────────────────────────────────────────────────────────────

interface TimelineProps {
  actions: FirmaAction[];
  signedUrls: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  proposalId: string;
  onActionDeleted: (actionId: string) => void;
}

function Timeline({
  actions,
  signedUrls,
  currentUserId,
  isAdmin,
  proposalId,
  onActionDeleted,
}: Readonly<TimelineProps>) {
  if (actions.length === 0) {
    return (
      <p className="rounded-[16px] bg-bg px-3 py-6 text-center text-[12.5px] text-text-faint">
        Sin movimientos todavía.
      </p>
    );
  }

  async function deleteNote(actionId: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    try {
      const res = await fetch(`/api/firmas/${proposalId}/actions/${actionId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onActionDeleted(actionId);
      toast.success("Nota eliminada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <ol className="relative flex flex-col">
      {actions.map((action, idx) => {
        const author =
          action.createdByUser.fullName?.trim() || action.createdByUser.email.split("@")[0];
        const dotStyle =
          action.toStatus && SIGNATURE_STATUS_STYLE[action.toStatus]
            ? SIGNATURE_STATUS_STYLE[action.toStatus].dot
            : "bg-olive-bright/70";
        const canDeleteThis =
          action.type === "nota" &&
          (isAdmin || action.createdByUser.id === currentUserId);

        return (
          <li key={action.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Vertical line */}
            {idx < actions.length - 1 && (
              <span className="absolute left-[7px] top-3 h-full w-px bg-border" />
            )}
            <span className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${dotStyle} ring-4 ring-surface`} />
            <div className="flex-1 rounded-[14px] bg-bg p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {action.createdByUser.avatarUrl ? (
                    <img
                      src={action.createdByUser.avatarUrl}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand-chip font-display text-[10px] font-bold uppercase text-text-muted">
                      {author[0]}
                    </span>
                  )}
                  <span className="text-[12.5px] font-bold text-text">{author}</span>
                  <ActionBadge action={action} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] text-text-faint">
                    {formatRelative(action.createdAt)}
                  </span>
                  {canDeleteThis && (
                    <button
                      type="button"
                      onClick={() => deleteNote(action.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-clay-chip hover:text-terra"
                      aria-label="Eliminar nota"
                      title="Eliminar nota"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {action.description && (
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-muted">
                  {action.description}
                </p>
              )}
              {action.attachments.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {action.attachments.map((att) => (
                    <AttachmentPreview
                      key={att.path}
                      attachment={att}
                      url={signedUrls[att.path]}
                    />
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActionBadge({ action }: { action: FirmaAction }) {
  if (action.type === "creation") {
    return (
      <span className="rounded-full bg-sand-chip px-2 py-0.5 text-[10px] font-bold text-warning">
        Creación
      </span>
    );
  }
  if (action.type === "status_change" && action.fromStatus && action.toStatus) {
    return (
      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-muted">
        {SIGNATURE_STATUS_LABEL[action.fromStatus]} → {SIGNATURE_STATUS_LABEL[action.toStatus]}
      </span>
    );
  }
  if (action.type === "date_set" && action.dateField) {
    const meta = SIGNATURE_DATE_META[action.dateField as SignatureDateField];
    return (
      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-muted">
        {meta?.shortLabel ?? "Fecha"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-faint">
      Nota
    </span>
  );
}

/* Adjunto como chip pill (V4) — abre el archivo en una pestaña nueva. */
function AttachmentChip({
  attachment,
  url,
}: Readonly<{ attachment: Attachment; url?: string }>) {
  const icon =
    attachment.kind === "image" ? (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </>
    ) : attachment.kind === "audio" ? (
      <>
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </>
    ) : attachment.kind === "video" ? (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </>
    ) : (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    );

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      title={attachment.name}
      className="inline-flex h-[30px] max-w-[220px] items-center gap-1.5 rounded-full bg-bg px-3 text-[11.5px] font-semibold text-text-muted transition-colors hover:text-text"
    >
      <svg className="shrink-0 text-text-faint" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      <span className="truncate">{attachment.name}</span>
    </a>
  );
}

// ──────────────────────────────────────────────────────────────────
// Add note section (form)
// ──────────────────────────────────────────────────────────────────

interface AddNoteSectionProps {
  firmaId: string;
  onAdded: (action: FirmaAction) => void;
}

function AddNoteSection({ firmaId, onAdded }: Readonly<AddNoteSectionProps>) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Resolve newly added attachments for preview
  const paths = attachments.map((a) => a.path);
  const signedUrls = useSignedUrls(paths);

  async function submit() {
    const cleanText = text.trim();
    if (!cleanText && attachments.length === 0) {
      toast.error("Agregá texto o un adjunto");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/firmas/${firmaId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: cleanText, attachments }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onAdded(serializeAction(body.data));
      setText("");
      setAttachments([]);
      toast.success("Nota agregada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[16px] bg-bg p-4">
      <h4 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
        Agregar nota
      </h4>
      <div className="flex items-center gap-2">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Agregar nota…"
          className="h-[38px] min-h-[38px] flex-1 resize-none rounded-full border border-border bg-surface px-4 py-[9px] text-[13px] leading-5 text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex h-[38px] shrink-0 items-center rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "Agregar"}
        </button>
      </div>
      <div className="mt-2.5">
        <MediaUploader
          attachments={attachments}
          onChange={setAttachments}
          signedUrls={signedUrls}
          compact
        />
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Local serializers (API response → UI shape)
// ──────────────────────────────────────────────────────────────────

function serializeAction(raw: unknown): FirmaAction {
  const r = raw as Record<string, unknown>;
  const u = r.createdByUser as Record<string, unknown>;
  return {
    id: r.id as string,
    type: r.type as FirmaAction["type"],
    fromStatus: (r.fromStatus as SignatureStatus | null) ?? null,
    toStatus: (r.toStatus as SignatureStatus | null) ?? null,
    dateField: (r.dateField as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    attachments: Array.isArray(r.attachments) ? (r.attachments as Attachment[]) : [],
    createdByUser: {
      id: u.id as string,
      email: u.email as string,
      fullName: (u.fullName as string | null) ?? null,
      avatarUrl: (u.avatarUrl as string | null | undefined) ?? null,
    },
    createdAt: new Date(r.createdAt as string).toISOString(),
  };
}

function serializeFromApi(raw: unknown): SerializedFirma {
  const r = raw as Record<string, unknown>;
  const property = r.property as Record<string, unknown>;
  const createdBy = r.createdByUser as Record<string, unknown>;
  return {
    id: r.id as string,
    property: {
      id: property.id as string,
      address: property.address as string,
      city: (property.city as string | null) ?? null,
      zone: (property.zone as string | null) ?? null,
      type: (property.type as string | null) ?? null,
      status: property.status as string,
      operationType: (property.operationType as string | null) ?? null,
      coverImageUrl: (property.coverImageUrl as string | null) ?? null,
    },
    status: r.status as SignatureStatus,
    title: (r.title as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    attachments: Array.isArray(r.attachments) ? (r.attachments as Attachment[]) : [],
    dateProcessStarted: r.dateProcessStarted ? new Date(r.dateProcessStarted as string).toISOString() : null,
    dateAgreed: r.dateAgreed ? new Date(r.dateAgreed as string).toISOString() : null,
    dateKeysHandover: r.dateKeysHandover ? new Date(r.dateKeysHandover as string).toISOString() : null,
    visitInformesId: (r.visitInformesId as string | null) ?? null,
    visitAcordadaId: (r.visitAcordadaId as string | null) ?? null,
    visitEntregaId: (r.visitEntregaId as string | null) ?? null,
    createdByUser: {
      id: createdBy.id as string,
      email: createdBy.email as string,
      fullName: (createdBy.fullName as string | null) ?? null,
      avatarUrl: (createdBy.avatarUrl as string | null | undefined) ?? null,
    },
    actions: ((r.actions as unknown[]) ?? []).map(serializeAction),
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}

void formatDate; // future use in headers
