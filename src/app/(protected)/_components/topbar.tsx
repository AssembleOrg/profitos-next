"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { CommandPalette } from "../dashboard/_components/command-palette";
import { useNavFavorites } from "./nav-favorites-context";
import { useAccess } from "./access-context";
import { useNotificationsContext } from "./notifications-context";
import { NotifPanelBody } from "./notif-card";
import { PREFETCH_HREFS } from "@/lib/nav/views";
import {
  NAV_META_LIST,
  NAV_GROUPS,
  getNavMeta,
  DEFAULT_MOBILE_TABS,
  type NavMeta,
} from "@/lib/nav/items";

interface TopbarProps {
  avatarUrl?: string | null;
  role?: "admin" | "user" | "viewer";
}

function StarIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "text-fav-gold" : "text-border-strong"}
    >
      <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" />
    </svg>
  );
}

/**
 * Topbar V4 — barra pill flotante de escritorio.
 * Marca · tabs de favoritos · menú "Más" agrupado (con estrellas) ·
 * buscador ⌘K · campana de notificaciones · avatar con "Cerrar sesión".
 */
export function Topbar({ avatarUrl, role }: Readonly<TopbarProps>) {
  const isAdmin = role === "admin";
  const pathname = usePathname();
  const { favorites, isFavorite, toggle: toggleFavorite } = useNavFavorites();
  const { canAccess } = useAccess();
  const { notifications, unreadCount, markAsSeen, loadNotifications } = useNotificationsContext();

  const [showMore, setShowMore] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    if (showMore || showNotifications || showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMore, showNotifications, showMenu]);

  const isVisible = (m: NavMeta) => {
    if (m.adminOnly && !isAdmin) return false;
    if (m.hideForAdmin && isAdmin) return false;
    return canAccess(m.href);
  };

  const resolveVisible = (hrefs: string[]): NavMeta[] =>
    hrefs.map(getNavMeta).filter((m): m is NavMeta => m !== undefined && isVisible(m));

  const favTabs = resolveVisible(favorites);
  const tabs = favTabs.length > 0 ? favTabs : resolveVisible(DEFAULT_MOBILE_TABS);
  const tabHrefs = new Set(tabs.map((t) => t.href));
  const visibleAll = NAV_META_LIST.filter(isVisible);
  const isMoreActive = visibleAll.some((i) => pathname === i.href && !tabHrefs.has(i.href));

  return (
    <div className="sticky top-0 z-40 hidden px-6 pt-4 md:block lg:px-10">
      <div className="flex h-[60px] items-center justify-between rounded-full border border-border bg-surface/95 pl-5 pr-2.5 shadow-lg backdrop-blur-xl">
        {/* Marca */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full bg-dark">
            <img src="/images/download.svg" alt="Juliana Profitos" className="h-6 w-6" />
          </span>
          <span className="hidden font-display text-[15px] font-semibold text-text xl:block">
            Profitos Propiedades
          </span>
        </Link>

        {/* Tabs de favoritos + Más */}
        <nav className="flex min-w-0 items-center gap-0.5 px-2">
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch={PREFETCH_HREFS.has(tab.href) ? undefined : false}
                  className={`flex h-[38px] shrink-0 items-center rounded-full px-4 text-[13.5px] transition-colors ${
                    isActive
                      ? "bg-dark font-bold text-dark-fg"
                      : "font-medium text-text-muted hover:bg-bg hover:text-text"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <span className="mx-1.5 h-5 w-px shrink-0 bg-border" />

          {/* Más — mega menú agrupado */}
          <div className="relative shrink-0" ref={moreRef}>
            <button
              onClick={() => setShowMore((v) => !v)}
              className={`flex h-[38px] items-center gap-1.5 rounded-full px-3.5 text-[13.5px] transition-colors ${
                isMoreActive || showMore
                  ? "bg-olive-deep font-bold text-text"
                  : "font-medium text-text-muted hover:bg-bg hover:text-text"
              }`}
            >
              Más
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showMore ? "rotate-180" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showMore && (
              <div className="absolute left-1/2 top-full z-50 mt-3 w-[560px] max-w-[80vw] -translate-x-1/2 rounded-3xl border border-border bg-surface p-5 shadow-2xl">
                <p className="mb-3 font-display text-[15px] font-semibold text-text">Todas las secciones</p>
                <div className="space-y-4">
                  {NAV_GROUPS.map((group) => {
                    const items = visibleAll.filter((i) => i.group === group.key);
                    if (items.length === 0) return null;
                    return (
                      <div key={group.key}>
                        {group.label && (
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-faint">
                            {group.label}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          {items.map((item) => {
                            const isActive = pathname === item.href;
                            const fav = isFavorite(item.href);
                            return (
                              <div key={item.href} className="relative">
                                <Link
                                  href={item.href}
                                  prefetch={PREFETCH_HREFS.has(item.href) ? undefined : false}
                                  onClick={() => setShowMore(false)}
                                  className={`flex h-10 items-center gap-2.5 rounded-xl px-2.5 pr-9 transition-colors ${
                                    isActive ? "bg-olive-deep" : "bg-bg hover:bg-surface-elevated"
                                  }`}
                                >
                                  <span className="shrink-0 text-text-muted [&_svg]:h-[15px] [&_svg]:w-[15px]">
                                    {item.icon}
                                  </span>
                                  <span className="truncate text-[12.5px] font-semibold text-text">{item.label}</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleFavorite(item.href);
                                  }}
                                  aria-label={fav ? "Quitar de favoritos" : "Marcar como favorito"}
                                  className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-transform hover:scale-110"
                                >
                                  <StarIcon active={fav} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-warning-chip px-3 py-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-fav-gold"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" /></svg>
                  <p className="text-[11.5px] text-text-muted">
                    Las secciones con estrella aparecen en la barra y en la navegación del teléfono
                  </p>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Derecha: ⌘K · campana · avatar */}
        <div className="flex shrink-0 items-center gap-2">
          <CommandPalette role={role} />

          {/* Notificaciones */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                const next = !showNotifications;
                setShowNotifications(next);
                if (next) {
                  loadNotifications().catch(() => {});
                  markAsSeen();
                }
              }}
              aria-label="Notificaciones"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-bg text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terra px-1 text-[9.5px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full z-50 mt-3 w-[390px] overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl">
                <NotifPanelBody
                  notifications={notifications}
                  onMarkSeen={() => markAsSeen()}
                  onNavigate={() => setShowNotifications(false)}
                />
              </div>
            )}
          </div>

          {/* Avatar + menú */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              aria-label="Mi cuenta"
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-warning-chip transition-opacity hover:opacity-85"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="font-display text-[13px] font-bold text-text">J</span>
              )}
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-3 min-w-[170px] rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
      </div>
    </div>
  );
}
