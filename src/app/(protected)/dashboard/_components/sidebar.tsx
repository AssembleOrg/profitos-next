"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { formatDateTime } from "@/lib/datetime";
import { useNavFavorites } from "../../_components/nav-favorites-context";
import { useAccess } from "../../_components/access-context";
import { useNotificationsContext } from "../../_components/notifications-context";
import { type NotificationItem } from "../../_components/use-notifications";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { PREFETCH_HREFS } from "@/lib/nav/views";
import { NAV_META_LIST, NAV_GROUPS as navGroups, type NavMeta } from "@/lib/nav/items";

type NavItem = NavMeta;
const navItems = NAV_META_LIST;


interface SidebarProps {
  avatarUrl?: string | null;
  role?: "admin" | "user" | "viewer";
}

interface NavLinkProps {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  fav: boolean;
  onToggleFav: (href: string) => void;
}

/**
 * Ítem del sidebar con su toggle de favorito. El botón de estrella es hermano
 * del Link (no anidado) para no meter un <button> dentro de un <a>.
 */
function NavLink({ item, collapsed, isActive, fav, onToggleFav }: Readonly<NavLinkProps>) {
  return (
    <div className="group relative">
      <Link
        href={item.href}
        prefetch={PREFETCH_HREFS.has(item.href) ? undefined : false}
        title={collapsed ? item.label : undefined}
        className={`relative flex h-9 items-center gap-3 rounded-lg text-sm transition-all duration-150 ${
          collapsed ? "justify-center px-0" : "px-3 pr-9"
        } ${
          isActive
            ? "bg-gradient-to-r from-olive-deep via-olive-deep/55 to-transparent font-medium text-accent shadow-[inset_2px_0_0_var(--color-olive-bright)]"
            : "text-text-muted hover:bg-surface-elevated hover:text-text"
        }`}
      >
        <span className={`shrink-0 ${isActive ? "text-olive-light" : "text-olive-vivid"}`}>{item.icon}</span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
      {!collapsed && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFav(item.href);
          }}
          aria-label={fav ? "Quitar de favoritos" : "Marcar como favorito"}
          className={`absolute right-1.5 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-opacity hover:bg-surface ${
            fav ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <svg
            width="13"
            height="13"
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
      )}
    </div>
  );
}

function formatNotificationDate(value: string) {
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

function SidebarNotifBody({ item }: Readonly<{ item: NotificationItem }>) {
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
          <p className="mt-0.5 text-xs text-red-300">Vencido: {item.dueDate ? formatNotificationDate(item.dueDate) : "sin fecha"}</p>
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

function SidebarNotifCard({ item }: Readonly<{ item: NotificationItem }>) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${NOTIF_CARD_CLASS[item.kind]}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${NOTIF_BADGE_CLASS[item.kind]}`}>
          {NOTIF_LABEL[item.kind]}
        </span>
        <span className="text-[11px] text-text-muted/80">{formatNotificationDate(item.eventAt)}</span>
      </div>
      <SidebarNotifBody item={item} />
    </div>
  );
}

export function Sidebar({ avatarUrl, role }: Readonly<SidebarProps>) {
  const isAdmin = role === "admin";
  const pathname = usePathname();
  const { favorites, isFavorite, toggle: toggleFavorite } = useNavFavorites();
  const { canAccess } = useAccess();
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("jp_sidebar_collapsed", false);

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForAdmin && isAdmin) return false;
    return canAccess(item.href);
  });
  const favoriteItems = favorites
    .map((href) => visibleNavItems.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i));

  const { notifications, unreadCount, markAsSeen, loadNotifications } = useNotificationsContext();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Sync CSS variable for layout margin (la persistencia la maneja useLocalStorage)
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "4rem" : "13rem");
  }, [collapsed]);

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

  return (
    <aside className={`fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-border-olive/50 bg-gradient-to-b from-surface/50 via-bg to-bg py-4 transition-all duration-200 md:flex ${collapsed ? "w-16" : "w-52"}`}>
      {/* Logo + toggle */}
      <div className={`mb-4 flex items-center border-b border-border/50 pb-4 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-olive-deep/50 ring-1 ring-border-olive/60">
            <img
              src="/images/download.svg"
              alt="Juliana Profitos"
              className="h-full w-full"
            />
          </div>
          {!collapsed && (
            <span className="bg-gradient-to-r from-text to-olive-light bg-clip-text text-sm font-semibold text-transparent">
              Profitos
            </span>
          )}
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
        {/* Favoritos */}
        {favoriteItems.length > 0 && (
          <div className={collapsed ? undefined : "mb-1 rounded-xl border border-fav-gold/15 bg-fav-gold/5 p-1.5"}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-fav-gold/40" />
            ) : (
              <p className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-fav-gold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" /></svg>
                Favoritos
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {favoriteItems.map((item) => (
                <NavLink
                  key={`fav-${item.href}`}
                  item={item}
                  collapsed={collapsed}
                  isActive={pathname === item.href}
                  fav={isFavorite(item.href)}
                  onToggleFav={toggleFavorite}
                />
              ))}
            </div>
          </div>
        )}

        {navGroups.map((group, groupIdx) => {
          const items = visibleNavItems.filter((item) => item.group === group.key);
          if (items.length === 0) return null;
          const showSeparator = groupIdx > 0 || favoriteItems.length > 0;
          return (
            <div key={group.key} className={showSeparator ? "mt-2" : undefined}>
              {showSeparator && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border-strong" />}
              {!collapsed && group.label && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-accent/70">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    isActive={pathname === item.href}
                    fav={isFavorite(item.href)}
                    onToggleFav={toggleFavorite}
                  />
                ))}
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
                loadNotifications().catch(() => {});
                markAsSeen();
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
                  onClick={() => markAsSeen()}
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
                    <SidebarNotifCard key={`${item.kind}-${item.id}`} item={item} />
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
