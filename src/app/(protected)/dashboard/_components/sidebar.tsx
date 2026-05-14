"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/datetime";

interface NotificationItem {
  kind: "contact" | "followup_assignment" | "contact_followup" | "property" | "overdue_followup";
  eventAt: string;
  id: string;
  name?: string;
  email?: string | null;
  cellphone?: string | null;
  phone?: string | null;
  leadStatus?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  tokkoCreatedAt?: string | null;
  createdAt?: string;
  tokkoContactId?: number;
  title?: string | null;
  status?: string;
  dueDate?: string | null;
  updatedAt?: string;
  property?: { id: string; address: string };
  recentContact?: { id: string; name: string; email: string | null; cellphone: string | null };
  assignedToUser?: { id: string; fullName: string | null; email: string };
  assignedByUser?: { id: string; fullName: string | null; email: string };
  address?: string;
  publicationTitle?: string | null;
  operationType?: string | null;
  operationPrice?: number | null;
  operationCurrency?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  group: "principal" | "clientes" | "propiedades" | "alquileres" | "gestion";
  adminOnly?: boolean;
  hideForAdmin?: boolean;
  icon: React.ReactNode;
}

const navGroups: { key: NavItem["group"]; label: string | null }[] = [
  { key: "principal", label: null },
  { key: "clientes", label: "Clientes y ventas" },
  { key: "propiedades", label: "Propiedades" },
  { key: "alquileres", label: "Alquileres" },
  { key: "gestion", label: "Gestión" },
];

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    group: "principal",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/contactos",
    label: "Contactos",
    group: "clientes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/consultants",
    label: "Últimos contactos",
    group: "clientes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 7-4-14-3 7H2" />
      </svg>
    ),
  },
  {
    href: "/consultants-followups",
    label: "Seg. consultas",
    group: "clientes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h18v12H3z" />
        <path d="M7 20h10" />
        <path d="M9 16v4" />
        <path d="M15 16v4" />
      </svg>
    ),
  },
  {
    href: "/seguimientos",
    label: "Seguimientos",
    group: "clientes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    href: "/agenda",
    label: "Agenda",
    group: "clientes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/propiedades",
    label: "Propiedades",
    group: "propiedades",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/tasaciones",
    label: "Tasaciones",
    group: "propiedades",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    href: "/firmas",
    label: "Estado de firmas",
    group: "propiedades",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
        <path d="M14 4h-2a2 2 0 00-2 2" opacity="0.3" />
      </svg>
    ),
  },
  {
    href: "/alquileres",
    label: "Alquileres",
    group: "alquileres",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M7 15h2" />
      </svg>
    ),
  },
  {
    href: "/inquilinos",
    label: "Inquilinos",
    group: "alquileres",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/objetivos",
    label: "Objetivos",
    group: "gestion",
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
    group: "gestion",
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
    href: "/adicionales",
    label: "Adicionales",
    group: "gestion",
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    href: "/miembros",
    label: "Miembros",
    group: "gestion",
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    href: "/configuracion",
    label: "Configuración",
    group: "gestion",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  avatarUrl?: string | null;
  role?: "admin" | "user" | "viewer";
}

function formatNotificationDate(value: string) {
  try { return formatDateTime(value); } catch { return "—"; }
}

export function Sidebar({ avatarUrl, role }: SidebarProps) {
  const isAdmin = role === "admin";
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("jp_sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Sync CSS variable for layout margin
  useEffect(() => {
    localStorage.setItem("jp_sidebar_collapsed", String(collapsed));
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "4rem" : "13rem");
  }, [collapsed]);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications/recent-contacts?limit=15", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = await res.json();
      const items = (body?.data?.items ?? []) as NotificationItem[];
      setNotifications(items);

      const lastSeen = localStorage.getItem("jp_last_notifications_seen_at");
      if (!lastSeen) {
        setUnreadCount(items.length > 0 ? 1 : 0);
        return;
      }
      const lastSeenMs = new Date(lastSeen).getTime();
      const count = items.filter((item) => {
        const eventAt = item.eventAt ?? item.tokkoCreatedAt ?? item.createdAt;
        if (!eventAt) return false;
        return new Date(eventAt).getTime() > lastSeenMs;
      }).length;
      setUnreadCount(count);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showMenu || showNotifications) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showNotifications]);

  useEffect(() => {
    const timerId = globalThis.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => {
      globalThis.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const schema = process.env.NEXT_PUBLIC_DB_SCHEMA ?? "profitos";
    const channel = supabase
      .channel("sidebar-last-contacts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema,
          table: "jp_ultimos_contactos",
        },
        () => {
          void loadNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema,
          table: "jp_contact_followups",
        },
        () => {
          void loadNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema,
          table: "jp_contact_followups",
        },
        () => {
          void loadNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema,
          table: "jp_propiedades",
        },
        () => {
          void loadNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema,
          table: "jp_property_followups",
        },
        () => {
          void loadNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema,
          table: "jp_property_followups",
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <aside className={`fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-border bg-bg py-4 transition-all duration-200 md:flex ${collapsed ? "w-16" : "w-52"}`}>
      {/* Logo + toggle */}
      <div className={`mb-8 flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <img
              src="/images/download.svg"
              alt="Juliana Profitos"
              className="h-full w-full"
            />
          </div>
          {!collapsed && <span className="text-sm font-semibold text-text">Profitos</span>}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
            title="Contraer sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="mb-2 flex justify-center px-2">
          <button
            onClick={() => setCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
            title="Expandir sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        {navGroups.map((group, groupIdx) => {
          const items = navItems.filter((item) => {
            if (item.group !== group.key) return false;
            if (item.adminOnly && !isAdmin) return false;
            if (item.hideForAdmin && isAdmin) return false;
            return true;
          });
          if (items.length === 0) return null;
          return (
            <div key={group.key} className={groupIdx > 0 ? "mt-2" : undefined}>
              {groupIdx > 0 && (
                collapsed ? (
                  <div className="mx-auto mb-2 h-px w-6 bg-border-strong" />
                ) : (
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-accent/70">
                    {group.label}
                  </p>
                )
              )}
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`relative flex h-9 items-center gap-3 rounded-lg text-sm transition-colors ${
                        collapsed ? "justify-center px-0" : "px-3"
                      } ${
                        isActive
                          ? "bg-olive-deep text-accent shadow-[inset_3px_0_0_var(--color-olive-bright)]"
                          : "text-text-muted hover:bg-surface-elevated hover:text-text"
                      }`}
                    >
                      <span className={`shrink-0 ${isActive ? "text-olive-light" : "text-olive-vivid"}`}>{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-2 px-2">
        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              if (next) {
                void loadNotifications();
                const now = new Date().toISOString();
                localStorage.setItem("jp_last_notifications_seen_at", now);
                setUnreadCount(0);
              }
            }}
            className={`relative flex h-10 items-center gap-3 rounded-lg text-sm text-text-muted transition-colors hover:bg-surface-elevated hover:text-text ${collapsed ? "w-10 justify-center mx-auto px-0" : "w-full px-3"}`}
            title={collapsed ? "Notificaciones" : undefined}
          >
            <span className="shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </span>
            {!collapsed && <span className="truncate">Notificaciones</span>}
            {unreadCount > 0 && (
              <span className={`inline-flex min-w-5 items-center justify-center rounded-full bg-olive-bright px-1.5 py-0.5 text-[10px] font-semibold text-bg ${collapsed ? "absolute -right-1 -top-1" : "ml-auto"}`}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute bottom-0 left-full z-50 ml-2 w-[390px] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-bg/30 px-3 py-2.5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Notificaciones</p>
                  <p className="mt-0.5 text-xs text-text-muted/70">
                    Últimos {notifications.length} evento{notifications.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const now = new Date().toISOString();
                    localStorage.setItem("jp_last_notifications_seen_at", now);
                    setUnreadCount(0);
                  }}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  Marcar leídas
                </button>
              </div>
              <div className="max-h-[380px] space-y-2 overflow-y-auto p-2">
                {notifications.length === 0 ? (
                  <p className="rounded-lg border border-border/70 bg-bg/30 px-3 py-4 text-sm text-text-muted">
                    Sin notificaciones.
                  </p>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
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
                        <span className="text-[11px] text-text-muted/80">{formatNotificationDate(item.eventAt)}</span>
                      </div>

                      {item.kind === "contact" ? (
                        <>
                          <p className="text-sm font-medium leading-tight text-text">
                            {item.name ?? "Contacto sin nombre"}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            Estado: {item.leadStatus ?? "Sin estado"} · Agente: {item.agentName ?? "Sin agente"}
                          </p>
                        </>
                      ) : item.kind === "followup_assignment" ? (
                        <>
                          <p className="text-sm font-medium leading-tight text-text">
                            {item.property?.address ?? "Propiedad sin dirección"}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            Responsable: {item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable"}
                          </p>
                          <p className="text-xs text-text-muted">
                            Estado: {item.status ?? "pendiente"}
                          </p>
                        </>
                      ) : item.kind === "contact_followup" ? (
                        <>
                          <p className="text-sm font-medium leading-tight text-text">
                            {item.recentContact?.name ?? "Consulta"}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            Responsable: {item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable"}
                          </p>
                          <p className="text-xs text-text-muted">
                            Estado: {item.status ?? "pendiente"}
                          </p>
                        </>
                      ) : item.kind === "overdue_followup" ? (
                        <>
                          <p className="text-sm font-medium leading-tight text-text">
                            {item.property?.address ?? "Propiedad sin dirección"}
                          </p>
                          <p className="mt-0.5 text-xs text-red-300">
                            Vencido: {item.dueDate ? formatNotificationDate(item.dueDate) : "sin fecha"}
                          </p>
                          <p className="text-xs text-text-muted">
                            Responsable: {item.assignedToUser?.fullName?.trim() || item.assignedToUser?.email || "Sin responsable"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium leading-tight text-text">
                            {item.address ?? item.publicationTitle ?? "Propiedad nueva"}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {item.operationType ?? "Operación no informada"} · Estado: {item.status ?? "activa"}
                          </p>
                          <p className="text-xs text-text-muted">
                            {item.operationCurrency ?? ""} {item.operationPrice?.toLocaleString("es-AR") ?? "Precio no informado"}
                          </p>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="grid grid-cols-2 border-t border-border bg-bg/30">
                <Link
                  href="/consultants"
                  onClick={() => setShowNotifications(false)}
                  className="block border-r border-border px-3 py-2.5 text-xs font-medium text-secondary transition-colors hover:bg-bg"
                >
                  Ver últimos contactos
                </Link>
                <Link
                  href="/seguimientos"
                  onClick={() => setShowNotifications(false)}
                  className="block px-3 py-2.5 text-xs font-medium text-secondary transition-colors hover:bg-bg"
                >
                  Ver seg. propiedades
                </Link>
              </div>
              <div className="border-t border-border bg-bg/20">
                <Link
                  href="/consultants-followups"
                  onClick={() => setShowNotifications(false)}
                  className="block px-3 py-2.5 text-xs font-medium text-secondary transition-colors hover:bg-bg"
                >
                  Ver seg. consultas
                </Link>
              </div>
            </div>
          )}
        </div>
        {/* Avatar + Logout menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className={`flex h-10 items-center gap-3 rounded-lg transition-opacity hover:opacity-80 ${collapsed ? "w-10 justify-center mx-auto px-0" : "w-full px-3"}`}
            title={collapsed ? "Mi cuenta" : undefined}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <img
                  src="/images/download.svg"
                  alt="Juliana Profitos"
                  className="h-full w-full"
                />
              )}
            </span>
            {!collapsed && <span className="truncate text-sm text-text-muted">Mi cuenta</span>}
          </button>

          {showMenu && (
            <div className="absolute bottom-0 left-full z-50 ml-2 min-w-[160px] rounded-lg border border-border bg-surface p-1 shadow-xl">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
