"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

interface NotificationItem {
  kind: "contact" | "followup_assignment" | "property";
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
  updatedAt?: string;
  property?: { id: string; address: string };
  assignedToUser?: { id: string; fullName: string | null; email: string };
  assignedByUser?: { id: string; fullName: string | null; email: string };
  address?: string;
  publicationTitle?: string | null;
  operationType?: string | null;
  operationPrice?: number | null;
  operationCurrency?: string | null;
}

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
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
    href: "/solicitudes",
    label: "Solicitudes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: "/contactos",
    label: "Contactos",
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
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 7-4-14-3 7H2" />
      </svg>
    ),
  },
  {
    href: "/agenda",
    label: "Agenda",
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
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/seguimientos",
    label: "Seguimientos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
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

interface SidebarProps {
  avatarUrl?: string | null;
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} · ${hh}:${min}`;
}

export function Sidebar({ avatarUrl }: SidebarProps) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

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
    void loadNotifications();
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
    <aside className="fixed left-0 top-0 z-40 flex h-dvh w-16 flex-col items-center border-r border-border bg-bg py-4">
      {/* Logo */}
      <div className="mb-8 flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
        <img
          src="/images/download.svg"
          alt="Juliana Profitos"
          className="h-full w-full"
        />
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? "bg-surface text-accent"
                  : "text-white/30 hover:bg-surface hover:text-white/60"
              }`}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-3">
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
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-surface hover:text-white/60"
            title="Notificaciones"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-black">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute bottom-0 left-14 z-50 w-[390px] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
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
                                : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {item.kind === "contact"
                            ? "Nuevo contacto"
                            : item.kind === "followup_assignment"
                              ? "Seguimiento"
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
                  Ver seguimientos
                </Link>
              </div>
            </div>
          )}
        </div>
        {/* Avatar + Logout menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition-opacity hover:opacity-80"
          >
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
          </button>

          {showMenu && (
            <div className="absolute bottom-0 left-14 z-50 min-w-[160px] rounded-lg border border-border bg-surface p-1 shadow-xl">
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
