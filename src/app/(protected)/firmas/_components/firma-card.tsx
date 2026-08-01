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
      className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-surface text-left transition-shadow hover:shadow-[0_10px_30px_-16px_rgba(27,25,22,0.28)]"
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
          <div className="flex h-full w-full items-center justify-center bg-sand-chip text-text-faint">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          {operationLabel && (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              {operationLabel}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle.chip}`}
          >
            {SIGNATURE_STATUS_LABEL[firma.status]}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-4 pb-3 pt-3.5">
        <div>
          <h3 className="line-clamp-1 text-[14.5px] font-bold leading-snug text-text">
            {firma.property.address}
          </h3>
          {(firma.property.zone || firma.property.city) && (
            <p className="mt-0.5 text-[11px] text-text-faint">
              {[firma.property.zone, firma.property.city].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {firma.title && (
          <p className="line-clamp-1 text-[12px] text-text-muted">
            <span className="text-text-faint">Propuesta: </span>
            {firma.title}
          </p>
        )}

        {/* Mini timeline */}
        <div className="flex items-center">
          {ORDERED_STATUSES.map((s, idx) => {
            const visited = visitedSet.has(s);
            const isCurrent = s === firma.status;
            const isLast = idx === ORDERED_STATUSES.length - 1;
            const dotClass = isRejected
              ? "h-2 w-2 bg-border"
              : isCurrent
                ? "h-3 w-3 bg-accent"
                : visited
                  ? "h-2 w-2 bg-olive-light"
                  : "h-2 w-2 bg-border";
            return (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <span
                  className={`shrink-0 rounded-full transition-all ${dotClass}`}
                  title={SIGNATURE_STATUS_LABEL[s]}
                />
                {!isLast && (
                  <span
                    className={`h-px flex-1 ${!isRejected && visited ? "bg-olive-light/45" : "bg-border"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {isRejected && (
          <p className="rounded-lg bg-clay-chip px-2.5 py-1.5 text-[11px] font-bold text-terra">
            Propuesta rechazada · proceso cerrado
          </p>
        )}

        {/* Dates row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {dates.map((d) =>
            d.value ? (
              <span
                key={d.label}
                className="rounded-lg bg-bg px-2 py-1 text-[10px] font-semibold text-text-muted"
              >
                {d.label} · {formatDate(d.value)}
              </span>
            ) : null,
          )}
          {dates.every((d) => !d.value) && (
            <span className="text-[10px] text-text-faint">Sin fechas seteadas</span>
          )}
          <span className="ml-auto shrink-0 text-[10px] text-text-faint">
            Act. {formatRelative(firma.updatedAt)}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] text-text-muted">
          <span className="inline-flex min-w-0 items-center gap-2">
            {firma.createdByUser.avatarUrl ? (
              <img
                src={firma.createdByUser.avatarUrl}
                alt=""
                className="h-[22px] w-[22px] shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-sand-chip font-display text-[10px] font-bold uppercase text-text-muted">
                {(firma.createdByUser.fullName ?? firma.createdByUser.email)[0]}
              </span>
            )}
            <span className="truncate text-[11px]">
              {firma.createdByUser.fullName?.trim() || firma.createdByUser.email.split("@")[0]}
            </span>
          </span>
          <span className="shrink-0 text-[11px] text-text-faint">
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
