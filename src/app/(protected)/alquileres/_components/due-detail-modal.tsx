"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { formatDate, formatRelative } from "@/lib/datetime";
import {
  RENTAL_DUE_STATUSES_MANUAL,
  RENTAL_DUE_STATUS_LABEL,
  RENTAL_DUE_STATUS_STYLE,
  formatARS,
  getDueEffectiveStatus,
  type RentalDueEffectiveStatus,
} from "@/lib/rentals";
import { AttachmentPreview, MediaUploader } from "./media-uploader";
import { useSignedUrls } from "./use-signed-urls";
import { RegisterPaymentForm } from "./register-payment-form";
import type {
  DueDateAction,
  PaymentTransaction,
  SerializedDueDate,
} from "./types";
import type { RentalAttachment } from "./voice-recorder";

interface DueDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  due: SerializedDueDate | null;
  contractTitle: string | null;
  propertyAddress: string;
  tenantName: string;
  gracePeriodDays: number;
  isAdmin: boolean;
  currentUserId: string;
  onUpdated: (due: SerializedDueDate) => void;
}

export function DueDetailModal({
  open,
  onOpenChange,
  due,
  contractTitle,
  propertyAddress,
  tenantName,
  gracePeriodDays,
  isAdmin,
  currentUserId,
  onUpdated,
}: Readonly<DueDetailModalProps>) {
  if (!due) return null;
  return (
    <Body
      open={open}
      due={due}
      contractTitle={contractTitle}
      propertyAddress={propertyAddress}
      tenantName={tenantName}
      gracePeriodDays={gracePeriodDays}
      isAdmin={isAdmin}
      currentUserId={currentUserId}
      onUpdated={onUpdated}
      onClose={() => onOpenChange(false)}
    />
  );
}

interface BodyProps extends Omit<DueDetailModalProps, "onOpenChange"> {
  onClose: () => void;
}

function Body({
  open,
  due,
  contractTitle,
  propertyAddress,
  tenantName,
  gracePeriodDays,
  isAdmin,
  currentUserId,
  onUpdated,
  onClose,
}: BodyProps) {
  const allPaths = useMemo(() => {
    const local = due;
    if (!local) return [] as string[];
    const paths: string[] = [];
    for (const t of local.transactions) {
      if (t.receiptPath) paths.push(t.receiptPath);
      if (Array.isArray(t.attachments)) {
        for (const a of t.attachments as RentalAttachment[]) paths.push(a.path);
      }
    }
    for (const a of local.actions) {
      if (Array.isArray(a.attachments)) {
        for (const att of a.attachments as RentalAttachment[]) paths.push(att.path);
      }
    }
    return paths;
  }, [due]);
  const signedUrls = useSignedUrls(allPaths);

  if (!due) return null;
  const collectedTotal = due.transactions.reduce((acc, t) => acc + t.amountPaid, 0);
  const effective: RentalDueEffectiveStatus = getDueEffectiveStatus({
    dueDate: due.dueDate,
    status: due.status,
    gracePeriodDays,
    expectedAmount: due.expectedAmount,
    collected: collectedTotal,
  });
  const style = RENTAL_DUE_STATUS_STYLE[effective];

  const commissionTotal = due.transactions.reduce((acc, t) => acc + t.commissionAmount, 0);
  const ownerTotal = due.transactions.reduce((acc, t) => acc + t.ownerAmount, 0);

  const dueId = due.id;
  async function patchDue(payload: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/alquileres/vencimientos/${dueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onUpdated(deserializeDue(body.data));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  function toggleAdditional(contractAdditionalId: string, included: boolean) {
    void patchDue({
      additionals: [{ contractAdditionalId, included }],
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      maxWidth="sm:max-w-[1040px]"
      title={
        <span className="flex items-center gap-2">
          <span className="line-clamp-1">
            Cuota Nº {due.position} — {formatDate(due.dueDate)}
          </span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${style.chip}`}
          >
            {RENTAL_DUE_STATUS_LABEL[effective]}
          </span>
        </span>
      }
      description={
        <span className="truncate">
          {propertyAddress}
          {contractTitle ? ` · ${contractTitle}` : ""} · {tenantName}
        </span>
      }
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] font-semibold text-text-faint transition-colors hover:text-text"
          >
            Cerrar
          </button>
        </div>
      }
    >
        <div className="flex flex-col gap-5">
          {/* Resumen montos — apretado, una fila */}
          <section className="grid grid-cols-4 gap-2">
            <SummaryCard label="Esperado" value={formatARS(due.expectedAmount)} />
            <SummaryCard label="Cobrado" value={formatARS(collectedTotal)} tone="emerald" />
            <SummaryCard label="Comisión" value={formatARS(commissionTotal)} tone="olive" />
            <SummaryCard label="Para el dueño" value={formatARS(ownerTotal)} />
          </section>

          {/* Desktop: 2 columnas — accionable (izq) / historial (der) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* ── Columna izquierda: accionable ── */}
          <div className="flex flex-col gap-5">
          {/* Adicionales toggle */}
          {due.additionals.length > 0 && (
            <section className="rounded-[16px] bg-bg p-4">
              <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                Adicionales en esta cuota
              </h4>
              <p className="mb-3 text-[11px] text-text-faint">
                Marcá cuáles aplican este mes. El monto esperado se recalcula automáticamente.
              </p>
              <div className="flex flex-col gap-1.5">
                {due.additionals.map((da) => {
                  const amount = da.amountOverride ?? da.contractAdditional.amount;
                  return (
                    <label
                      key={da.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2 transition-colors ${
                        da.included
                          ? "border-transparent bg-sage-chip"
                          : "border-border bg-surface opacity-70"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={da.included}
                        onChange={(e) =>
                          toggleAdditional(da.contractAdditionalId, e.target.checked)
                        }
                        className="h-3.5 w-3.5 accent-olive-light"
                      />
                      <span className="flex-1 text-sm text-text">
                        {da.contractAdditional.additional.name}
                      </span>
                      <span className="font-display text-xs font-bold text-text-muted">
                        {formatARS(amount)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Status manual */}
          <section className="rounded-[16px] bg-bg p-4">
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Estado
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => patchDue({ status: null })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  due.status === null
                    ? "border-transparent bg-dark font-bold text-dark-fg"
                    : "border-border bg-surface font-medium text-text-muted hover:text-text"
                }`}
              >
                Automático (según fecha)
              </button>
              {RENTAL_DUE_STATUSES_MANUAL.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patchDue({ status: s })}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    due.status === s
                      ? `font-bold ${RENTAL_DUE_STATUS_STYLE[s].chip}`
                      : "border-border bg-surface font-medium text-text-muted hover:text-text"
                  }`}
                >
                  {RENTAL_DUE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>

          {/* Form registrar pago */}
          <RegisterPaymentForm
            due={due}
            onRegistered={(payment) => {
              const next: SerializedDueDate = {
                ...due,
                transactions: [payment, ...due.transactions],
                status:
                  payment.isFull ? "pagado" : due.status === "pagado" ? "pagado" : "parcial",
              };
              onUpdated(next);
            }}
          />
          </div>

          {/* ── Columna derecha: historial ── */}
          <div className="flex flex-col gap-5">
          {/* Pagos registrados */}
          {due.transactions.length > 0 && (
            <section>
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
                Pagos registrados
              </h4>
              <ol className="flex flex-col gap-2">
                {due.transactions.map((tx) => (
                  <PaymentRow
                    key={tx.id}
                    tx={tx}
                    signedUrls={signedUrls}
                    canDelete={isAdmin || tx.createdByUser.id === currentUserId}
                    onDeleted={() => {
                      const next: SerializedDueDate = {
                        ...due,
                        transactions: due.transactions.filter((t) => t.id !== tx.id),
                      };
                      onUpdated(next);
                    }}
                    dueDateId={due.id}
                  />
                ))}
              </ol>
            </section>
          )}

          {/* Timeline */}
          <section>
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
              Línea de tiempo
            </h4>
            <Timeline
              actions={due.actions}
              signedUrls={signedUrls}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              dueDateId={due.id}
              onActionDeleted={(actionId) => {
                onUpdated({
                  ...due,
                  actions: due.actions.filter((a) => a.id !== actionId),
                });
              }}
            />
          </section>

          {/* Add note */}
          <AddNote
            dueDateId={due.id}
            onAdded={(action) => {
              onUpdated({ ...due, actions: [action, ...due.actions] });
            }}
          />
          </div>
          </div>
        </div>
    </Sheet>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "olive";
}) {
  const valueClass =
    tone === "emerald" ? "text-olive-light" : tone === "olive" ? "text-accent" : "text-text";
  return (
    <div className="flex flex-col gap-0.5 rounded-[12px] bg-bg p-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-faint">
        {label}
      </span>
      <span className={`truncate font-display text-[13px] font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

interface PaymentRowProps {
  tx: PaymentTransaction;
  signedUrls: Record<string, string>;
  canDelete: boolean;
  dueDateId: string;
  onDeleted: () => void;
}

function PaymentRow({ tx, signedUrls, canDelete, dueDateId, onDeleted }: PaymentRowProps) {
  const author = tx.createdByUser.fullName?.trim() || tx.createdByUser.email.split("@")[0];
  const receiptUrl = tx.receiptPath ? signedUrls[tx.receiptPath] : null;
  const attList = Array.isArray(tx.attachments) ? (tx.attachments as RentalAttachment[]) : [];

  async function deleteThis() {
    if (!confirm("¿Eliminar este pago? El comprobante asociado quedará sin referencia.")) return;
    try {
      const res = await fetch(`/api/alquileres/vencimientos/${dueDateId}/pagos/${tx.id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      toast.success("Pago eliminado");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <li className="rounded-[14px] bg-bg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              tx.isFull
                ? "bg-success-chip text-success"
                : "bg-warning-chip text-warning"
            }`}
          >
            {tx.isFull ? "Total" : "Parcial"}
          </span>
          <span className="font-display text-sm font-bold text-text">{formatARS(tx.amountPaid, { decimals: true })}</span>
          {tx.method && <span className="text-[11px] text-text-muted">· {tx.method}</span>}
        </div>
        <span className="text-[10px] text-text-faint">
          {formatDate(tx.paidAt)} · por {author}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
        <span>
          <span className="text-text-faint">Comisión: </span>
          <span className="font-display font-bold text-text">{formatARS(tx.commissionAmount)}</span>
        </span>
        <span>
          <span className="text-text-faint">Para dueño: </span>
          <span className="font-display font-bold text-text">{formatARS(tx.ownerAmount)}</span>
        </span>
      </div>
      {tx.notes && (
        <p className="mt-2 whitespace-pre-wrap text-xs text-text-muted">{tx.notes}</p>
      )}
      {attList.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {attList.map((att) => (
            <AttachmentPreview key={att.path} attachment={att} url={signedUrls[att.path]} />
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tx.receiptNumber && (
          <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-text-muted">
            #{String(tx.receiptNumber).padStart(8, "0")}
          </span>
        )}
        {receiptUrl ? (
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-terra transition-opacity hover:opacity-80"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar comprobante
          </a>
        ) : tx.receiptIssuedAt === null ? (
          <span className="text-[10px] text-text-faint">Generando comprobante…</span>
        ) : null}
        {canDelete && (
          <button
            type="button"
            onClick={deleteThis}
            className="ml-auto rounded-full bg-clay-chip px-2.5 py-1 text-[10px] font-bold text-terra transition-opacity hover:opacity-80"
          >
            Eliminar pago
          </button>
        )}
      </div>
    </li>
  );
}

interface TimelineProps {
  actions: DueDateAction[];
  signedUrls: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  dueDateId: string;
  onActionDeleted: (actionId: string) => void;
}

function Timeline({ actions, signedUrls, currentUserId, isAdmin, dueDateId, onActionDeleted }: TimelineProps) {
  if (actions.length === 0) {
    return (
      <p className="rounded-[14px] bg-bg px-3 py-4 text-center text-xs text-text-faint">
        Sin movimientos.
      </p>
    );
  }

  async function deleteNote(actionId: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    try {
      const res = await fetch(`/api/alquileres/vencimientos/${dueDateId}/notas/${actionId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onActionDeleted(actionId);
      toast.success("Nota eliminada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <ol className="relative flex flex-col">
      {actions.map((action, idx) => {
        const author =
          action.createdByUser.fullName?.trim() || action.createdByUser.email.split("@")[0];
        const dotColor =
          action.type === "payment"
            ? "bg-olive-light"
            : action.type === "status_change"
              ? "bg-accent"
              : action.type === "creation"
                ? "bg-accent"
                : "bg-text-faint";
        const canDelete = action.type === "nota" && (isAdmin || action.createdByUser.id === currentUserId);
        const attList = Array.isArray(action.attachments)
          ? (action.attachments as RentalAttachment[])
          : [];
        return (
          <li key={action.id} className="relative flex gap-3 pb-4 last:pb-0">
            {idx < actions.length - 1 && (
              <span className="absolute left-[13px] top-3 h-full w-px bg-border" />
            )}
            <span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg ring-4 ring-surface">
              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
            </span>
            <div className="flex-1 rounded-[12px] bg-bg p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text">{author}</span>
                  <ActionBadge action={action} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-faint">{formatRelative(action.createdAt)}</span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteNote(action.id)}
                      className="text-text-faint transition-colors hover:text-danger"
                      aria-label="Eliminar nota"
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
                <p className="whitespace-pre-wrap text-sm text-text-muted">{action.description}</p>
              )}
              {attList.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {attList.map((att) => (
                    <AttachmentPreview key={att.path} attachment={att} url={signedUrls[att.path]} />
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

function ActionBadge({ action }: { action: DueDateAction }) {
  if (action.type === "creation") {
    return (
      <span className="rounded-full bg-sand-chip px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">
        Creación
      </span>
    );
  }
  if (action.type === "status_change") {
    return (
      <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[9px] font-medium text-text-muted">
        {action.fromStatus ? `${action.fromStatus} → ${action.toStatus ?? "—"}` : "estado"}
      </span>
    );
  }
  if (action.type === "payment") {
    return (
      <span className="rounded-full bg-sage-chip px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-olive-light">
        Pago
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[9px] font-medium text-text-muted">
      Nota
    </span>
  );
}

interface AddNoteProps {
  dueDateId: string;
  onAdded: (action: DueDateAction) => void;
}

function AddNote({ dueDateId, onAdded }: AddNoteProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<RentalAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
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
      const res = await fetch(`/api/alquileres/vencimientos/${dueDateId}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: cleanText, attachments }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      const u = body.data.createdByUser;
      onAdded({
        id: body.data.id,
        type: "nota",
        fromStatus: null,
        toStatus: null,
        description: body.data.description,
        attachments: body.data.attachments,
        createdByUser: {
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          avatarUrl: u.avatarUrl ?? null,
        },
        createdAt: new Date(body.data.createdAt).toISOString(),
      });
      setText("");
      setAttachments([]);
      toast.success("Nota agregada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[16px] bg-bg p-4">
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">
        Agregar nota
      </h4>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Comentario, novedad, contexto…"
        className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2 text-sm text-text focus:border-border-strong focus:outline-none"
      />
      <div className="mt-2">
        <MediaUploader attachments={attachments} onChange={setAttachments} signedUrls={signedUrls} compact />
      </div>
      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-text-muted transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "Agregar nota"}
        </button>
      </div>
    </section>
  );
}

function deserializeDue(raw: unknown): SerializedDueDate {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    contractId: r.contractId as string,
    position: r.position as number,
    dueDate:
      typeof r.dueDate === "string"
        ? r.dueDate.slice(0, 10)
        : new Date(r.dueDate as string).toISOString().slice(0, 10),
    expectedAmount: r.expectedAmount as number,
    status: r.status as SerializedDueDate["status"],
    notes: (r.notes as string | null) ?? null,
    additionals: ((r.additionals as unknown[]) ?? []).map((a) => {
      const ar = a as Record<string, unknown>;
      const ca = ar.contractAdditional as Record<string, unknown>;
      const ad = ca.additional as Record<string, unknown>;
      return {
        id: ar.id as string,
        contractAdditionalId: ar.contractAdditionalId as string,
        included: ar.included as boolean,
        amountOverride: (ar.amountOverride as number | null) ?? null,
        contractAdditional: {
          id: ca.id as string,
          contractId: (ca.contractId as string) ?? "",
          additionalId: ca.additionalId as string,
          amount: ca.amount as number,
          position: (ca.position as number) ?? 0,
          additional: { id: ad.id as string, name: ad.name as string },
        },
      };
    }),
    transactions: ((r.transactions as unknown[]) ?? []).map((t) => {
      const tr = t as Record<string, unknown>;
      const u = tr.createdByUser as Record<string, unknown>;
      return {
        id: tr.id as string,
        amountPaid: tr.amountPaid as number,
        commissionAmount: tr.commissionAmount as number,
        ownerAmount: tr.ownerAmount as number,
        method: (tr.method as string | null) ?? null,
        paidAt: new Date(tr.paidAt as string).toISOString(),
        isFull: tr.isFull as boolean,
        notes: (tr.notes as string | null) ?? null,
        attachments: tr.attachments,
        receiptNumber: (tr.receiptNumber as number | null) ?? null,
        receiptPath: (tr.receiptPath as string | null) ?? null,
        receiptIssuedAt: tr.receiptIssuedAt ? new Date(tr.receiptIssuedAt as string).toISOString() : null,
        createdByUser: {
          id: u.id as string,
          email: u.email as string,
          fullName: (u.fullName as string | null) ?? null,
          avatarUrl: (u.avatarUrl as string | null | undefined) ?? null,
        },
        createdAt: new Date(tr.createdAt as string).toISOString(),
      };
    }),
    actions: ((r.actions as unknown[]) ?? []).map((a) => {
      const ar = a as Record<string, unknown>;
      const u = ar.createdByUser as Record<string, unknown>;
      return {
        id: ar.id as string,
        type: ar.type as DueDateAction["type"],
        fromStatus: (ar.fromStatus as string | null) ?? null,
        toStatus: (ar.toStatus as string | null) ?? null,
        description: (ar.description as string | null) ?? null,
        attachments: ar.attachments,
        createdByUser: {
          id: u.id as string,
          email: u.email as string,
          fullName: (u.fullName as string | null) ?? null,
          avatarUrl: (u.avatarUrl as string | null | undefined) ?? null,
        },
        createdAt: new Date(ar.createdAt as string).toISOString(),
      };
    }),
  };
}
