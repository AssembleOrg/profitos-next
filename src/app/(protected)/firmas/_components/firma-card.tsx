"use client";

import { motion } from "framer-motion";
import { formatDate, formatRelative } from "@/lib/datetime";
import {
  SIGNATURE_DATE_META,
  SIGNATURE_STATUSES,
  SIGNATURE_STATUS_LABEL,
  SIGNATURE_STATUS_SHORT,
  SIGNATURE_STATUS_STYLE,
  type SignatureStatus,
} from "@/lib/signatures";
import type { SerializedFirma } from "./types";

interface FirmaCardProps {
  firma: SerializedFirma;
  onOpen: (firma: SerializedFirma) => void;
}

const ORDERED_STATUSES: SignatureStatus[] = [
  "propuesta_enviada",
  "propuesta_aceptada",
  "espera_informes",
  "comunicacion_partes_finales",
  "fecha_acordada",
  "entrega_llaves",
];

function buildTimelineHistory(actions: SerializedFirma["actions"]): Set<SignatureStatus> {
  const seen = new Set<SignatureStatus>();
  for (const action of actions) {
    if (action.toStatus) seen.add(action.toStatus);
  }
  return seen;
}

export function FirmaCard({ firma, onOpen }: Readonly<FirmaCardProps>) {
  const statusStyle = SIGNATURE_STATUS_STYLE[firma.status];
  const isRejected = firma.status === "propuesta_rechazada";
  const visitedSet = buildTimelineHistory(firma.actions);
  visitedSet.add(firma.status);

  const dates: Array<{ label: string; value: string | null }> = [
    { label: SIGNATURE_DATE_META.dateProcessStarted.shortLabel, value: firma.dateProcessStarted },
    { label: SIGNATURE_DATE_META.dateAgreed.shortLabel, value: firma.dateAgreed },
    { label: SIGNATURE_DATE_META.dateKeysHandover.shortLabel, value: firma.dateKeysHandover },
  ];

  const operationLabel = firma.property.operationType
    ? firma.property.operationType.charAt(0).toUpperCase() + firma.property.operationType.slice(1)
    : null;

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onOpen(firma)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface/60 text-left transition-shadow hover:shadow-[0_0_0_1px_var(--color-border-olive),0_18px_40px_-12px_rgba(0,0,0,0.55)]"
    >
      {/* Cover */}
      <div className="relative aspect-[16/8] w-full overflow-hidden bg-bg">
        {firma.property.coverImageUrl ? (
          <img
            src={firma.property.coverImageUrl}
            alt={firma.property.address}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-elevated text-text-faint">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          {operationLabel && (
            <span className="rounded-full border border-border-strong bg-bg/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text">
              {operationLabel}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${statusStyle.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
            {SIGNATURE_STATUS_LABEL[firma.status]}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        <div>
          <h3 className="line-clamp-1 text-sm font-semibold text-text">{firma.property.address}</h3>
          {(firma.property.zone || firma.property.city) && (
            <p className="mt-0.5 text-[11px] text-text-faint">
              {[firma.property.zone, firma.property.city].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {firma.title && (
          <p className="line-clamp-1 text-xs font-medium text-text-muted">
            <span className="text-text-faint">Propuesta: </span>
            {firma.title}
          </p>
        )}

        {/* Mini timeline */}
        <div className="flex items-center gap-1.5">
          {ORDERED_STATUSES.map((s, idx) => {
            const visited = visitedSet.has(s);
            const isCurrent = s === firma.status;
            const isLast = idx === ORDERED_STATUSES.length - 1;
            const dotClass = isCurrent
              ? statusStyle.dot
              : visited
                ? "bg-olive-bright/70"
                : "bg-border";
            return (
              <div key={s} className="flex flex-1 items-center gap-1">
                <span
                  className={`h-1.5 flex-shrink-0 rounded-full transition-all ${dotClass} ${
                    isCurrent ? "w-3 ring-2 ring-offset-2 ring-offset-surface ring-current" : "w-1.5"
                  }`}
                  title={SIGNATURE_STATUS_LABEL[s]}
                />
                {!isLast && (
                  <span
                    className={`h-px flex-1 ${visited ? "bg-olive-bright/40" : "bg-border"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {isRejected && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] font-medium text-red-300">
            Propuesta rechazada · proceso cerrado
          </p>
        )}

        {/* Dates row */}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {dates.map((d) =>
              d.value ? (
                <span key={d.label} className="text-text-muted">
                  <span className="text-text-faint">{d.label}: </span>
                  <span className="font-mono text-text">{formatDate(d.value)}</span>
                </span>
              ) : null,
            )}
            {dates.every((d) => !d.value) && (
              <span className="text-text-faint">Sin fechas seteadas</span>
            )}
          </div>
          <span className="shrink-0 text-text-faint">
            Act. {formatRelative(firma.updatedAt)}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            {firma.createdByUser.avatarUrl ? (
              <img
                src={firma.createdByUser.avatarUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-bg text-[8px] font-semibold uppercase text-text-faint">
                {(firma.createdByUser.fullName ?? firma.createdByUser.email)[0]}
              </span>
            )}
            <span className="truncate">
              {firma.createdByUser.fullName?.trim() || firma.createdByUser.email.split("@")[0]}
            </span>
          </span>
          <span className="font-mono text-[10px] text-text-faint">
            {firma.actions.length} {firma.actions.length === 1 ? "evento" : "eventos"}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

// Pequeña sanity guard: si SIGNATURE_STATUSES cambia de longitud, ajustar
void SIGNATURE_STATUSES;
void SIGNATURE_STATUS_SHORT;
