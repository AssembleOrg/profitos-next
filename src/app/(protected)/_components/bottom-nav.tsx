"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useNotificationsContext } from "./notifications-context";
import { NotifPanelBody } from "./notif-card";
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

export function BottomNav({ role }: Readonly<BottomNavProps> = {}) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const moreDrag = useDragControls();
  const notifDrag = useDragControls();
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
              className="fixed inset-0 z-40 bg-scrim md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-surface md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 96px)" }}
              drag="y"
              dragListener={false}
              dragControls={notifDrag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) setShowNotifications(false);
              }}
            >
              <div
                onPointerDown={(e) => notifDrag.start(e)}
                style={{ touchAction: "none" }}
                className="cursor-grab active:cursor-grabbing"
              >
                <div className="mx-auto my-3 h-1 w-10 rounded-full bg-border-strong" />
              </div>
              <div className="max-h-[62dvh] overflow-y-auto">
                <NotifPanelBody
                  notifications={notifications}
                  onMarkSeen={() => markAsSeen()}
                  onNavigate={() => setShowNotifications(false)}
                />
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
              className="fixed inset-0 z-40 bg-scrim md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowMore(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-surface md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 96px)" }}
              drag="y"
              dragListener={false}
              dragControls={moreDrag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) setShowMore(false);
              }}
            >
              {/* Handle + título: única zona que inicia el drag-to-close */}
              <div
                onPointerDown={(e) => moreDrag.start(e)}
                style={{ touchAction: "none" }}
                className="cursor-grab active:cursor-grabbing"
              >
                <div className="mx-auto my-3 h-1 w-10 rounded-full bg-border-strong" />
                <p className="px-5 pb-3 pt-1 font-display text-base font-semibold text-text">
                  Más secciones
                </p>
              </div>

              {/* Grid of items */}
              <div className="grid max-h-[58dvh] grid-cols-3 gap-2 overflow-y-auto px-4 pb-2">
                {/* Notifications entry */}
                <button
                  onClick={() => {
                    setShowMore(false);
                    loadNotifications().catch(() => {});
                    setShowNotifications(true);
                  }}
                  className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-bg px-2 py-4 text-text-muted transition-colors active:bg-surface-elevated"
                >
                  <span className="relative">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-terra px-1 py-0.5 text-[9px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="text-center text-[11px] font-semibold leading-tight text-text-muted">
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
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-4 transition-colors active:scale-95 ${
                          isActive
                            ? "bg-olive-deep text-text"
                            : "bg-bg text-text-muted active:bg-surface-elevated"
                        }`}
                      >
                        <span className={isActive ? "text-text" : "text-text-muted"}>
                          {item.icon}
                        </span>
                        <span className={`text-center text-[11px] font-semibold leading-tight ${isActive ? "text-text" : "text-text-muted"}`}>
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
                          className={fav ? "text-fav-gold" : "text-border-strong"}
                        >
                          <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mx-5 mt-2 flex items-center gap-1.5 rounded-xl bg-warning-chip px-3 py-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-fav-gold"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" /></svg>
                <p className="text-[11px] text-text-muted">
                  Las secciones con estrella se fijan en la barra
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating bottom bar — pill V4 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 10px)" }}
      >
        <nav className="mx-4 flex items-stretch rounded-full border border-border bg-surface p-1.5 shadow-2xl">
          {/* Zona scrolleable de favoritos */}
          <div className="relative min-w-0 flex-1">
            <div className="flex items-stretch gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      <span className="absolute inset-0 rounded-[18px] bg-dark" />
                    )}
                    <Link
                      href={tab.href}
                      prefetch={PREFETCH_HREFS.has(tab.href) ? undefined : false}
                      className="relative z-10 flex w-full flex-col items-center justify-center gap-0.5 py-2"
                    >
                      <span className={`shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] ${isActive ? "text-accent" : "text-text-faint"}`}>
                        {tab.icon}
                      </span>
                      <span
                        className={`w-full truncate text-center text-[9.5px] leading-none ${
                          isActive ? "font-bold text-dark-fg" : "font-medium text-text-faint"
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
                className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-full bg-gradient-to-l from-surface to-transparent"
              />
            )}
          </div>

          {/* Más button — fijo, fuera del scroll */}
          <motion.div
            className="relative w-[18vw] max-w-[64px] shrink-0"
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.1 }}
          >
            {(isMoreActive || showMore) && (
              <span className="absolute inset-0 rounded-[18px] bg-olive-deep" />
            )}
            <button
              onClick={() => setShowMore((v) => !v)}
              className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-0.5 py-2"
            >
              <span className={`relative shrink-0 ${isMoreActive || showMore ? "text-text" : "text-text-faint"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-terra px-1 py-0.5 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={`w-full truncate text-center text-[9.5px] leading-none ${
                  isMoreActive || showMore ? "font-bold text-text" : "font-medium text-text-faint"
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
