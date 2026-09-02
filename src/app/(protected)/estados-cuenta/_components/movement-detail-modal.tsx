"use client";

import { useEffect, useState } from "react";
import { Sheet } from "../../_components/sheet";
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
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      maxWidth="sm:max-w-[480px]"
      title={
        <span className="flex items-center gap-2">
          Detalle del movimiento
          {isRental && (
            <span className="rounded-md bg-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-faint">
              Auto · alquiler
            </span>
          )}
          {movement.isShared && (
            <span className="rounded-md bg-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-faint">
              Compartido
            </span>
          )}
        </span>
      }
      footer={
        <>
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
                className="inline-flex h-10 items-center rounded-full bg-clay-chip px-4 text-[13px] font-bold text-terra transition-opacity hover:opacity-90"
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
                className="inline-flex h-10 items-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
              >
                Editar
              </button>
            )}
          </div>
        </>
      }
    >
                <div>
                  {/* Monto */}
                  <div className="mb-4 text-center">
                    <p className={`font-display text-3xl font-bold ${movement.type === "income" ? "text-olive-light" : "text-terra"}`}>
                      {movement.type === "income" ? "+" : "−"}
                      {formatMoney(movement.amount, movement.currency)}
                    </p>
                    <p className="mt-1 text-xs text-text-faint">{movement.currency} · {movement.type === "income" ? "Ingreso" : "Egreso"}</p>
                  </div>

                  <dl className="flex flex-col gap-0 divide-y divide-border border-t border-border">
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
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint">Comprobantes</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {attachments.map((att) => (
                          <AttachmentPreview key={att.path} attachment={att} url={signedUrls[att.path]} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
    </Sheet>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-start justify-between gap-3 px-1 py-2.5">
      <dt className="shrink-0 text-xs font-semibold text-text-faint">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-semibold text-text">{value}</dd>
    </div>
  );
}
