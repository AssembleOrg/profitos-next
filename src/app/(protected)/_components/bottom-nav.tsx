"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { type NotificationItem } from "./use-notifications";
import { useNotificationsContext } from "./notifications-context";
import { formatDateTime } from "@/lib/datetime";
import { useNavFavorites } from "./nav-favorites-context";
import { useAccess } from "./access-context";
import { PREFETCH_HREFS } from "@/lib/nav/views";
import {
  NAV_META_LIST,
  getNavMeta,
  DEFAULT_MOBILE_TABS,
  type NavMeta,
} from "@/lib/nav/items";


interface BottomNavProps {
  role?: "admin" | "user" | "viewer";
}

function formatNotifDate(value: string) {
  try { return formatDateTime(value); } catch { return "—"; }
}

// Estilos y etiquetas por tipo de notificación (evita ternarios anidados).
const NOTIF_CARD_CLASS: Record<NotificationItem["kind"], string> = {
  contact: "border-sky-500/30 bg-sky-500/10",
  followup_assignment: "border-amber-500/30 bg-amber-500/10",
  contact_followup: "border-fuchsia-500/30 bg-fuchsia-500/10",
  overdue_followup: "border-red-500/30 bg-red-500/10",
  property: "border-emerald-500/30 bg-emerald-500/10",
};

const NOTIF_BADGE_CLASS: Record<NotificationItem["kind"], string> = {
  contact: "bg-sky-500/20 text-sky-300",
  followup_assignment: "bg-amber-500/20 text-amber-300",
  contact_followup: "bg-fuchsia-500/20 text-fuchsia-300",
  overdue_followup: "bg-red-500/20 text-red-300",
  property: "bg-emerald-500/20 text-emerald-300",
};

const NOTIF_LABEL: Record<NotificationItem["kind"], string> = {
  contact: "Nuevo contacto",
  followup_assignment: "Seguimiento",
  contact_followup: "Seg. consulta",
  overdue_followup: "Vencido",
  property: "Propiedad nueva",
};

function NotifBody({ item }: Readonly<{ item: NotificationItem }>) {
  const responsable = item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable";
  switch (item.kind) {
    case "contact":
      return (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.name ?? "Contacto sin nombre"}</p>
          <p className="mt-0.5 text-xs text-text-muted">Estado: {item.leadStatus ?? "Sin estado"} · Agente: {item.agentName ?? "Sin agente"}</p>
        </>
      );
    case "followup_assignment":
      return (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.property?.address ?? "Propiedad sin dirección"}</p>
          <p className="mt-0.5 text-xs text-text-muted">Responsable: {responsable}</p>
          <p className="text-xs text-text-muted">Estado: {item.status ?? "pendiente"}</p>
        </>
      );
    case "contact_followup":
      return (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.recentContact?.name ?? "Consulta"}</p>
          <p className="mt-0.5 text-xs text-text-muted">Responsable: {responsable}</p>
          <p className="text-xs text-text-muted">Estado: {item.status ?? "pendiente"}</p>
        </>
      );
    case "overdue_followup":
      return (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.property?.address ?? "Propiedad sin dirección"}</p>
          <p className="mt-0.5 text-xs text-red-300">Vencido: {item.dueDate ? formatNotifDate(item.dueDate) : "sin fecha"}</p>
          <p className="text-xs text-text-muted">Responsable: {responsable}</p>
        </>
      );
    default:
      return (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.address ?? item.publicationTitle ?? "Propiedad nueva"}</p>
          <p className="mt-0.5 text-xs text-text-muted">{item.operationType ?? "Operación no informada"} · Estado: {item.status ?? "activa"}</p>
          <p className="text-xs text-text-muted">{item.operationCurrency ?? ""} {item.operationPrice?.toLocaleString("es-AR") ?? "Precio no informado"}</p>
        </>
      );
  }
}

function NotifCard({ item }: Readonly<{ item: NotificationItem }>) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${NOTIF_CARD_CLASS[item.kind]}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${NOTIF_BADGE_CLASS[item.kind]}`}>
          {NOTIF_LABEL[item.kind]}
        </span>
        <span className="text-[11px] text-text-muted/80">{formatNotifDate(item.eventAt)}</span>
      </div>
      <NotifBody item={item} />
    </div>
  );
}

export function BottomNav({ role }: Readonly<BottomNavProps> = {}) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const isAdmin = role === "admin";
  const { favorites, isFavorite: isFav, toggle: toggleFav } = useNavFavorites();
  const { canAccess } = useAccess();
  const { notifications, unreadCount, markAsSeen, loadNotifications } = useNotificationsContext();

  const isVisible = (m: NavMeta) => {
    if (m.adminOnly && !isAdmin) return false;
    if (m.hideForAdmin && isAdmin) return false;
    return canAccess(m.href);
  };

  // Tabs primarias = favoritos del usuario (accesibles), con fallback a los
  // defaults cuando no tiene favoritos. Se muestran todas: con 5+ la fila
  // scrollea horizontalmente y el botón "Más" queda fijo.
  const resolveVisible = (hrefs: string[]): NavMeta[] =>
    hrefs
      .map(getNavMeta)
      .filter((m): m is NavMeta => m !== undefined && isVisible(m));

  const favTabs = resolveVisible(favorites);
  const visiblePrimaryTabs = favTabs.length > 0 ? favTabs : resolveVisible(DEFAULT_MOBILE_TABS);

  // El sheet "Más" lista TODO lo favoriteable (incluidas las tabs primarias,
  // para poder desmarcarlas). Favoritos arriba.
  const visibleMoreItems = NAV_META_LIST.filter(isVisible);
  const sortedMoreItems = [
    ...favorites
      .map((href) => visibleMoreItems.find((i) => i.href === href))
      .filter((item): item is NavMeta => Boolean(item)),
    ...visibleMoreItems.filter((i) => !isFav(i.href)),
  ];

  const primaryHrefs = new Set(visiblePrimaryTabs.map((t) => t.href));
  const isMoreActive = visibleMoreItems.some((i) => pathname === i.href && !primaryHrefs.has(i.href));

  return (
    <>
      {/* Notifications sheet */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border-olive/40 bg-surface/95 backdrop-blur-2xl md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 88px)" }}
            >
              <div className="mx-auto my-3 h-1 w-10 rounded-full bg-white/20" />

              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 pb-3 pt-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Notificaciones</p>
                  <p className="mt-0.5 text-xs text-text-muted/70">
                    Últimos {notifications.length} evento{notifications.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => { markAsSeen(); }}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-medium text-text-muted transition-colors active:bg-white/5"
                >
                  Marcar leídas
                </button>
              </div>

              <div className="max-h-[55dvh] space-y-2 overflow-y-auto p-3">
                {notifications.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-sm text-text-muted">
                    Sin notificaciones.
                  </p>
                ) : (
                  notifications.map((item) => (
                    <NotifCard key={`${item.kind}-${item.id}`} item={item} />
                  ))
                )}
              </div>

              <div className="grid grid-cols-2 border-t border-white/10">
                <Link
                  href="/consultants"
                  onClick={() => setShowNotifications(false)}
                  className="block border-r border-white/10 px-4 py-3 text-xs font-medium text-secondary active:bg-white/5"
                >
                  Ver últimos contactos
                </Link>
                <Link
                  href="/seguimientos"
                  onClick={() => setShowNotifications(false)}
                  className="block px-4 py-3 text-xs font-medium text-secondary active:bg-white/5"
                >
                  Ver seg. propiedades
                </Link>
              </div>
              <div className="border-t border-white/10">
                <Link
                  href="/consultants-followups"
                  onClick={() => setShowNotifications(false)}
                  className="block px-4 py-3 text-xs font-medium text-secondary active:bg-white/5"
                >
                  Ver seg. consultas
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* More sheet overlay */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowMore(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border-olive/40 bg-surface/95 backdrop-blur-2xl md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 88px)" }}
            >
              {/* Handle */}
              <div className="mx-auto my-3 h-1 w-10 rounded-full bg-white/20" />

              <p className="px-5 pb-3 pt-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Más secciones
              </p>

              {/* Grid of items */}
              <div className="grid grid-cols-3 gap-1 px-3 pb-2">
                {/* Notifications entry */}
                <button
                  onClick={() => {
                    setShowMore(false);
                    loadNotifications().catch(() => {});
                    setShowNotifications(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 transition-colors text-text-muted active:bg-white/5 relative"
                >
                  <span className="relative text-olive-vivid">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-olive-bright px-1 py-0.5 text-[9px] font-semibold text-bg">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="text-center text-[11px] font-medium leading-tight text-text-muted">
                    Notificaciones
                  </span>
                </button>

                {sortedMoreItems.map((item) => {
                  const isActive = pathname === item.href;
                  const fav = isFav(item.href);
                  return (
                    // La estrella es HERMANA del Link (no anidada) para no meter
                    // un <button> dentro de un <a> (HTML inválido que rompía el toggle).
                    <div key={item.href} className="relative">
                      <Link
                        href={item.href}
                        prefetch={PREFETCH_HREFS.has(item.href) ? undefined : false}
                        onClick={() => setShowMore(false)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 transition-colors active:scale-95 ${
                          isActive
                            ? "bg-accent/15 text-accent"
                            : "text-text-muted active:bg-white/5"
                        }`}
                      >
                        <span className={isActive ? "text-accent" : "text-olive-vivid"}>
                          {item.icon}
                        </span>
                        <span className={`text-center text-[11px] font-medium leading-tight ${isActive ? "text-accent" : "text-text-muted"}`}>
                          {item.label}
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFav(item.href);
                        }}
                        aria-label={fav ? "Quitar de favoritos" : "Marcar como favorito"}
                        className="absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill={fav ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={fav ? "text-fav-gold" : "text-text-subtle"}
                        >
                          <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 8px)" }}
      >
        <nav className="mx-3 mb-2 flex items-stretch rounded-2xl border border-border-olive/40 bg-gradient-to-b from-surface/80 to-bg/70 p-1 shadow-2xl backdrop-blur-2xl">
          {/* Zona scrolleable de favoritos */}
          <div className="relative min-w-0 flex-1">
            <div className="flex items-stretch gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visiblePrimaryTabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <motion.div
                    key={tab.href}
                    className="relative w-[22vw] max-w-[88px] shrink-0"
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.1 }}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-olive-mid/25 to-olive-deep/60 ring-1 ring-inset ring-olive-bright/25" />
                    )}
                    <Link
                      href={tab.href}
                      prefetch={PREFETCH_HREFS.has(tab.href) ? undefined : false}
                      className="relative z-10 flex w-full flex-col items-center justify-center gap-0.5 py-2"
                    >
                      <span className={`shrink-0 ${isActive ? "text-accent" : "text-text-muted"}`}>
                        {tab.icon}
                      </span>
                      <span
                        className={`w-full truncate text-center text-[9px] font-medium leading-none ${
                          isActive ? "text-accent" : "text-text-muted"
                        }`}
                      >
                        {tab.shortLabel ?? tab.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            {/* Fade: indica que hay más tabs para scrollear */}
            {visiblePrimaryTabs.length > 4 && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-bg/80 to-transparent"
              />
            )}
          </div>

          {/* Más button — fijo, fuera del scroll */}
          <motion.div
            className="relative w-[20vw] max-w-[76px] shrink-0"
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.1 }}
          >
            {(isMoreActive || showMore) && (
              <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-olive-mid/25 to-olive-deep/60 ring-1 ring-inset ring-olive-bright/25" />
            )}
            <button
              onClick={() => setShowMore((v) => !v)}
              className="relative z-10 flex w-full flex-col items-center justify-center gap-0.5 py-2"
            >
              <span className={`relative shrink-0 ${isMoreActive || showMore ? "text-accent" : "text-text-muted"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-olive-bright px-1 py-0.5 text-[9px] font-semibold text-bg">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={`w-full truncate text-center text-[9px] font-medium leading-none ${
                  isMoreActive || showMore ? "text-accent" : "text-text-muted"
                }`}
              >
                Más
              </span>
            </button>
          </motion.div>
        </nav>
      </div>
    </>
  );
}
