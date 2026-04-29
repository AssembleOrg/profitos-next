"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications, type NotificationItem } from "./use-notifications";
import { formatDateTime } from "@/lib/datetime";

const primaryTabs = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/contactos",
    label: "Contactos",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/propiedades",
    label: "Propiedades",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

interface MoreItem {
  href: string;
  label: string;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
  icon: React.ReactNode;
}

const moreItems: MoreItem[] = [
  {
    href: "/consultants",
    label: "Últimos contactos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: "/consultants-followups",
    label: "Seg. consultas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: "/seguimientos",
    label: "Seguimientos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: "/firmas",
    label: "Firmas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    href: "/alquileres",
    label: "Alquileres",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h5l2 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/inquilinos",
    label: "Inquilinos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M12 11v2m0 4h.01" />
      </svg>
    ),
  },
  {
    href: "/tasaciones",
    label: "Tasaciones",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    href: "/adicionales",
    label: "Adicionales",
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: "/objetivos",
    label: "Objetivos",
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    href: "/mis-objetivos",
    label: "Mis objetivos",
    hideForAdmin: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    href: "/miembros",
    label: "Miembros",
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

interface BottomNavProps {
  role?: "admin" | "user" | "viewer";
}

function formatNotifDate(value: string) {
  try { return formatDateTime(value); } catch { return "—"; }
}

function NotifCard({ item }: { item: NotificationItem }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        item.kind === "contact"
          ? "border-sky-500/30 bg-sky-500/10"
          : item.kind === "followup_assignment"
            ? "border-amber-500/30 bg-amber-500/10"
            : item.kind === "contact_followup"
              ? "border-fuchsia-500/30 bg-fuchsia-500/10"
              : item.kind === "overdue_followup"
                ? "border-red-500/30 bg-red-500/10"
            : "border-emerald-500/30 bg-emerald-500/10"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            item.kind === "contact"
              ? "bg-sky-500/20 text-sky-300"
              : item.kind === "followup_assignment"
                ? "bg-amber-500/20 text-amber-300"
                : item.kind === "contact_followup"
                  ? "bg-fuchsia-500/20 text-fuchsia-300"
                  : item.kind === "overdue_followup"
                    ? "bg-red-500/20 text-red-300"
                : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          {item.kind === "contact"
            ? "Nuevo contacto"
            : item.kind === "followup_assignment"
              ? "Seguimiento"
              : item.kind === "contact_followup"
                ? "Seg. consulta"
                : item.kind === "overdue_followup"
                  ? "Vencido"
              : "Propiedad nueva"}
        </span>
        <span className="text-[11px] text-text-muted/80">{formatNotifDate(item.eventAt)}</span>
      </div>

      {item.kind === "contact" ? (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.name ?? "Contacto sin nombre"}</p>
          <p className="mt-0.5 text-xs text-text-muted">Estado: {item.leadStatus ?? "Sin estado"} · Agente: {item.agentName ?? "Sin agente"}</p>
        </>
      ) : item.kind === "followup_assignment" ? (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.property?.address ?? "Propiedad sin dirección"}</p>
          <p className="mt-0.5 text-xs text-text-muted">Responsable: {item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable"}</p>
          <p className="text-xs text-text-muted">Estado: {item.status ?? "pendiente"}</p>
        </>
      ) : item.kind === "contact_followup" ? (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.recentContact?.name ?? "Consulta"}</p>
          <p className="mt-0.5 text-xs text-text-muted">Responsable: {item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable"}</p>
          <p className="text-xs text-text-muted">Estado: {item.status ?? "pendiente"}</p>
        </>
      ) : item.kind === "overdue_followup" ? (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.property?.address ?? "Propiedad sin dirección"}</p>
          <p className="mt-0.5 text-xs text-red-300">Vencido: {item.dueDate ? formatNotifDate(item.dueDate) : "sin fecha"}</p>
          <p className="text-xs text-text-muted">Responsable: {item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable"}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium leading-tight text-text">{item.address ?? item.publicationTitle ?? "Propiedad nueva"}</p>
          <p className="mt-0.5 text-xs text-text-muted">{item.operationType ?? "Operación no informada"} · Estado: {item.status ?? "activa"}</p>
          <p className="text-xs text-text-muted">{item.operationCurrency ?? ""} {item.operationPrice?.toLocaleString("es-AR") ?? "Precio no informado"}</p>
        </>
      )}
    </div>
  );
}

export function BottomNav({ role }: Readonly<BottomNavProps> = {}) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAsSeen, loadNotifications } = useNotifications();
  const isAdmin = role === "admin";

  const visibleMoreItems = moreItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForAdmin && isAdmin) return false;
    return true;
  });

  const isMoreActive = visibleMoreItems.some((i) => pathname === i.href);

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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/10 bg-surface/95 backdrop-blur-2xl md:hidden"
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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/10 bg-surface/95 backdrop-blur-2xl md:hidden"
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
                    void loadNotifications();
                    setShowNotifications(true);
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 transition-colors text-text-muted active:bg-white/5 relative"
                >
                  <span className="relative text-white/50">
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
                  <span className="text-center text-[11px] font-medium leading-tight text-white/60">
                    Notificaciones
                  </span>
                </button>

                {visibleMoreItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 transition-colors active:scale-95 ${
                        isActive
                          ? "bg-accent/15 text-accent"
                          : "text-text-muted active:bg-white/5"
                      }`}
                    >
                      <span className={isActive ? "text-accent" : "text-white/50"}>
                        {item.icon}
                      </span>
                      <span className={`text-center text-[11px] font-medium leading-tight ${isActive ? "text-accent" : "text-white/60"}`}>
                        {item.label}
                      </span>
                    </Link>
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
        <nav className="mx-3 mb-2 flex items-stretch overflow-hidden rounded-2xl border border-white/8 bg-white/5 p-1 shadow-2xl backdrop-blur-2xl">
          {primaryTabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <motion.div
                key={tab.href}
                className="relative min-w-0 flex-1"
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-accent/20"
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <Link
                  href={tab.href}
                  className="relative z-10 flex w-full flex-col items-center justify-center gap-0.5 py-2"
                >
                  <span className={`shrink-0 ${isActive ? "text-accent" : "text-white/35"}`}>
                    {tab.icon}
                  </span>
                  <span
                    className={`w-full truncate text-center text-[9px] font-medium leading-none ${
                      isActive ? "text-accent" : "text-white/35"
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              </motion.div>
            );
          })}

          {/* Más button */}
          <motion.div
            className="relative min-w-0 flex-1"
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.1 }}
          >
            {(isMoreActive || showMore) && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-xl bg-accent/20"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <button
              onClick={() => setShowMore((v) => !v)}
              className="relative z-10 flex w-full flex-col items-center justify-center gap-0.5 py-2"
            >
              <span className={`relative shrink-0 ${isMoreActive || showMore ? "text-accent" : "text-white/35"}`}>
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
                  isMoreActive || showMore ? "text-accent" : "text-white/35"
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
