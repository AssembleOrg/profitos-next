"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const primaryTabs = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

interface MoreItem {
  href: string;
  label: string;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
}

const moreItems: MoreItem[] = [
  { href: "/propiedades", label: "Propiedades" },
  { href: "/consultants", label: "Últimos contactos" },
  { href: "/consultants-followups", label: "Seg. consultas" },
  { href: "/seguimientos", label: "Seguimientos" },
  { href: "/firmas", label: "Estado de firmas" },
  { href: "/alquileres", label: "Alquileres" },
  { href: "/inquilinos", label: "Inquilinos" },
  { href: "/adicionales", label: "Adicionales", adminOnly: true },
  { href: "/objetivos", label: "Objetivos", adminOnly: true },
  { href: "/mis-objetivos", label: "Mis objetivos", hideForAdmin: true },
  { href: "/configuracion", label: "Configuración" },
];

interface BottomNavProps {
  role?: "admin" | "user" | "viewer";
}

export function BottomNav({ role }: Readonly<BottomNavProps> = {}) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const isAdmin = role === "admin";

  const visibleMoreItems = moreItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForAdmin && isAdmin) return false;
    return true;
  });

  const isMoreActive = visibleMoreItems.some((i) => pathname === i.href);

  return (
    <>
      {/* Sheet overlay */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowMore(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-surface md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{ paddingBottom: "calc(80px + var(--safe-bottom))" }}
            >
              <div className="mx-auto my-3 h-1 w-10 rounded-full bg-border" />
              <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Más secciones
              </p>
              <div className="flex flex-col">
                {visibleMoreItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`px-5 py-3.5 text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? "text-accent"
                        : "text-text-muted active:text-text"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="flex items-center justify-around px-2 pt-1 pb-1">
          {primaryTabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <motion.div key={tab.href} whileTap={{ scale: 0.88 }} transition={{ duration: 0.1 }}>
                <Link
                  href={tab.href}
                  className="flex flex-col items-center gap-0.5 px-3 py-2"
                >
                  <span className={isActive ? "text-accent" : "text-white/30"}>
                    {tab.icon}
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      isActive ? "text-accent" : "text-white/30"
                    }`}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-dot"
                      className="h-0.5 w-4 rounded-full bg-accent"
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </Link>
              </motion.div>
            );
          })}

          {/* Más */}
          <motion.div whileTap={{ scale: 0.88 }} transition={{ duration: 0.1 }}>
            <button
              onClick={() => setShowMore((v) => !v)}
              className="flex flex-col items-center gap-0.5 px-3 py-2"
            >
              <span className={isMoreActive || showMore ? "text-accent" : "text-white/30"}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="12" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                </svg>
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isMoreActive || showMore ? "text-accent" : "text-white/30"
                }`}
              >
                Más
              </span>
              {(isMoreActive || showMore) && (
                <motion.span
                  layoutId="bottom-nav-dot"
                  className="h-0.5 w-4 rounded-full bg-accent"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </button>
          </motion.div>
        </div>
      </nav>
    </>
  );
}
