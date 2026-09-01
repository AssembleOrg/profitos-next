"use client";

import Link from "next/link";
import { type NotificationItem } from "./use-notifications";
import { formatDateTime } from "@/lib/datetime";

function formatNotifDate(value: string) {
  try { return formatDateTime(value); } catch { return "—"; }
}

// Estilos y etiquetas por tipo de notificación (evita ternarios anidados).
const NOTIF_BADGE_CLASS: Record<NotificationItem["kind"], string> = {
  followup_assignment: "bg-warning-chip text-warning",
  overdue_followup: "bg-clay-chip text-terra",
  property: "bg-sage-chip text-success",
  publication_closed: "bg-clay-chip text-terra",
  contact: "bg-info-chip text-info",
};

const NOTIF_LABEL: Record<NotificationItem["kind"], string> = {
  followup_assignment: "Seguimiento",
  overdue_followup: "Vencido",
  property: "Propiedad nueva",
  publication_closed: "Baja aviso",
  contact: "Contacto",
};

const PORTAL_LABEL: Record<string, string> = {
  mercadolibre: "MercadoLibre",
  zonaprop: "ZonaProp",
  argenprop: "ArgenProp",
};
const STATUS_LABEL: Record<string, string> = { paused: "pausada", closed: "cerrada" };

function notifOrigin(item: NotificationItem): string {
  const propUser = item.createdByUser?.fullName?.trim() || item.createdByUser?.email;
  switch (item.kind) {
    case "property":
      return propUser
        ? `Usuario: ${propUser}`
        : `Origen: ${item.producerName?.trim() || item.branchName?.trim() || "Importación"}`;
    default:
      return `Responsable: ${item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable"}`;
  }
}

function NotifBody({ item }: Readonly<{ item: NotificationItem }>) {
  const responsable = item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable";
  switch (item.kind) {
    case "followup_assignment":
      return (
        <>
          <p className="text-sm font-bold leading-tight text-text">{item.property?.address ?? "Propiedad sin dirección"}</p>
          <p className="mt-0.5 text-xs text-text-faint">Responsable: {responsable} · Estado: {item.status ?? "pendiente"}</p>
        </>
      );
    case "overdue_followup":
      return (
        <>
          <p className="text-sm font-bold leading-tight text-text">{item.property?.address ?? "Propiedad sin dirección"}</p>
          <p className="mt-0.5 text-xs font-semibold text-terra">Vencido: {item.dueDate ? formatNotifDate(item.dueDate) : "sin fecha"} · {responsable}</p>
        </>
      );
    case "publication_closed":
      return (
        <>
          <p className="text-sm font-bold leading-tight text-text">{item.property?.address ?? "Propiedad sin dirección"}</p>
          <p className="mt-0.5 text-xs font-semibold text-terra">
            {PORTAL_LABEL[item.portal ?? ""] ?? item.portal ?? "Portal"}: {STATUS_LABEL[item.status ?? ""] ?? item.status ?? "baja"}
          </p>
        </>
      );
    case "contact":
      return (
        <>
          <p className="text-sm font-bold leading-tight text-text">
            {item.contactName?.trim() || (item.portal === "mercadolibre" ? "Pregunta en ML" : "Contacto sin nombre")}
          </p>
          <p className="mt-0.5 truncate text-xs text-text-faint">
            {PORTAL_LABEL[item.portal ?? ""] ?? item.portal}
            {item.property?.address || item.propertyTitle ? ` · ${item.property?.address ?? item.propertyTitle}` : ""}
            {item.message ? ` · “${item.message.slice(0, 60)}”` : ""}
          </p>
        </>
      );
    default:
      return (
        <>
          <p className="text-sm font-bold leading-tight text-text">{item.address ?? item.publicationTitle ?? "Propiedad nueva"}</p>
          <p className="mt-0.5 text-xs text-text-faint">
            {item.operationType ?? "Operación no informada"} · {item.operationCurrency ?? ""} {item.operationPrice?.toLocaleString("es-AR") ?? "s/precio"} · {notifOrigin(item)}
          </p>
        </>
      );
  }
}

/**
 * Link a la propiedad de la notificación: lista filtrada por dirección y
 * `open=<id>` para que el modal se abra solo. Null si no hay propiedad.
 */
function notifHref(item: NotificationItem): string | null {
  const propId = item.kind === "property" ? item.id : item.property?.id;
  if (!propId) {
    // Contacto sin propiedad nuestra: al menos llevar a la central de mensajes.
    return item.kind === "contact" ? "/consultants" : null;
  }
  const addr = item.kind === "property" ? item.address : item.property?.address;
  const q = addr ? `q=${encodeURIComponent(addr)}&` : "";
  return `/propiedades?${q}open=${propId}`;
}

/** Tarjeta de notificación V4 — fondo canvas, pill tintada por tipo. */
export function NotifCard({ item, onNavigate }: Readonly<{ item: NotificationItem; onNavigate?: () => void }>) {
  const href = notifHref(item);
  const body = (
    <>
      <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${NOTIF_BADGE_CLASS[item.kind]}`}>
        {NOTIF_LABEL[item.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <NotifBody item={item} />
      </div>
      <span className="shrink-0 text-[10.5px] text-text-faint">{formatNotifDate(item.eventAt)}</span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-start gap-2.5 rounded-[14px] bg-bg px-3 py-2.5 transition-colors hover:bg-surface-elevated"
      >
        {body}
      </Link>
    );
  }
  return <div className="flex items-start gap-2.5 rounded-[14px] bg-bg px-3 py-2.5">{body}</div>;
}

/** Popover/sheet de notificaciones — cuerpo compartido entre topbar y bottom nav. */
export function NotifPanelBody({
  notifications,
  onMarkSeen,
  onNavigate,
}: Readonly<{
  notifications: NotificationItem[];
  onMarkSeen: () => void;
  onNavigate?: () => void;
}>) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <div>
          <p className="font-display text-[15px] font-semibold text-text">Notificaciones</p>
          <p className="text-[11px] text-text-faint">
            Últimos {notifications.length} evento{notifications.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={onMarkSeen}
          className="rounded-full bg-bg px-3 py-1.5 text-[11.5px] font-bold text-text-muted transition-colors hover:bg-surface-elevated"
        >
          Marcar leídas
        </button>
      </div>
      <div className="max-h-[380px] space-y-1.5 overflow-y-auto px-3 pb-2">
        {notifications.length === 0 ? (
          <p className="rounded-[14px] bg-bg px-3 py-4 text-sm text-text-faint">Sin notificaciones.</p>
        ) : (
          notifications.map((item) => <NotifCard key={`${item.kind}-${item.id}`} item={item} onNavigate={onNavigate} />)
        )}
      </div>
      <div className="mx-4 mb-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <NotifFooterLink href="/consultants" label="Últimos contactos" onNavigate={onNavigate} />
        <NotifFooterLink href="/seguimientos" label="Seg. propiedades" onNavigate={onNavigate} />
      </div>
    </>
  );
}

function NotifFooterLink({ href, label, onNavigate }: Readonly<{ href: string; label: string; onNavigate?: () => void }>) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="text-[11.5px] font-bold text-terra transition-opacity hover:opacity-75"
    >
      {label} →
    </Link>
  );
}
