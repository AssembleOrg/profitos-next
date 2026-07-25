"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { formatDate } from "@/lib/datetime";
import { formatMoney, isWithinEditWindow, EDIT_WINDOW_HOURS, type AccountMovement } from "@/lib/account";
import { AttachmentPreview } from "../../alquileres/_components/media-uploader";
import type { RentalAttachment } from "../../alquileres/_components/voice-recorder";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movement: AccountMovement | null;
  isAdmin: boolean;
  nowMs: number;
  onEdit: (m: AccountMovement) => void;
  onDelete: (m: AccountMovement) => void;
}

function asAttachments(value: unknown): RentalAttachment[] {
  return Array.isArray(value) ? (value as RentalAttachment[]) : [];
}

export function MovementDetailModal({ open, onOpenChange, movement, isAdmin, nowMs, onEdit, onDelete }: Readonly<Props>) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const attachments = asAttachments(movement?.attachments);

  useEffect(() => {
    if (!open || attachments.length === 0) {
      setSignedUrls({});
      return;
    }
    let active = true;
    const paths = attachments.map((a) => a.path).filter(Boolean);
    (async () => {
      try {
        const res = await fetch("/api/alquileres/signed-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths }),
        });
        const body = await res.json();
        if (active) setSignedUrls(body?.urls ?? {});
      } catch {
        if (active) setSignedUrls({});
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, movement?.id]);

  if (!movement) return null;

  const isRental = movement.source === "rental_commission";
  const canEdit = !isRental && isWithinEditWindow(movement.createdAt, nowMs);
  const canDelete = !isRental && isAdmin;
  const locked = !isRental && !isWithinEditWindow(movement.createdAt, nowMs);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm" />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[min(480px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
              >
                <header className="flex items-center justify-between gap-3 border-b border-border-olive/40 px-5 py-4">
                  <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-text">
                    Detalle del movimiento
                    {isRental && (
                      <span className="rounded-full bg-olive-deep px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                        Auto · alquiler
                      </span>
                    )}
                    {movement.isShared && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">
                        Compartido
                      </span>
                    )}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button type="button" aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-bg hover:text-text">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </Dialog.Close>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {/* Monto */}
                  <div className="mb-4 text-center">
                    <p className={`font-mono text-3xl font-bold ${movement.type === "income" ? "text-success" : "text-danger"}`}>
                      {movement.type === "income" ? "+" : "−"}
                      {formatMoney(movement.amount, movement.currency)}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">{movement.currency} · {movement.type === "income" ? "Ingreso" : "Egreso"}</p>
                  </div>

                  <dl className="flex flex-col gap-0 divide-y divide-border rounded-xl border border-border">
                    <Row label="Categoría" value={movement.categoryName ?? "—"} />
                    <Row label="Fecha" value={formatDate(movement.date)} />
                    {movement.agentName && <Row label="Agente" value={movement.agentName} />}
                    {movement.agentPercentage != null && (
                      <Row
                        label="Valor al agente"
                        value={
                          movement.agentShareType === "amount"
                            ? formatMoney(movement.agentPercentage, movement.currency)
                            : `${movement.agentPercentage}%`
                        }
                      />
                    )}
                    {movement.propertyAddress && <Row label="Propiedad" value={movement.propertyAddress} />}
                    {movement.description && <Row label="Descripción" value={movement.description} />}
                    {movement.createdByName && <Row label="Cargado por" value={movement.createdByName} />}
                  </dl>

                  {attachments.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Comprobantes</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {attachments.map((att) => (
                          <AttachmentPreview key={att.path} attachment={att} url={signedUrls[att.path]} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <footer className="flex items-center justify-between gap-2 border-t border-border bg-bg/30 px-5 py-3">
                  <span className="text-[11px] text-text-faint">
                    {isRental
                      ? "Generado desde un pago de alquiler"
                      : locked
                        ? `No editable (pasaron ${EDIT_WINDOW_HOURS} hs)`
                        : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          onDelete(movement);
                        }}
                        className="rounded-xl border border-danger/30 bg-danger-chip px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-chip"
                      >
                        Borrar
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          onEdit(movement);
                        }}
                        className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-olive-vivid"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </footer>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <dt className="shrink-0 text-xs font-medium text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-text">{value}</dd>
    </div>
  );
}
