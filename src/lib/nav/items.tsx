// ────────────────────────────────────────────────────────────────────
// Registro compartido de presentación de la navegación (ícono + label +
// grupo + flags de visibilidad), keyed por href. Lo consumen el sidebar
// (desktop) y el bottom-nav (mobile) para resolver lo mismo por href y que
// los favoritos queden sincronizados entre ambos.
//
// NOTA: el control de acceso vive en @/lib/nav/views (APP_VIEWS, canAccess).
// Acá solo va presentación; no mezclar.
// ────────────────────────────────────────────────────────────────────

import type { ReactNode } from "react";

export type NavGroup =
  | "principal"
  | "clientes"
  | "propiedades"
  | "alquileres"
  | "finanzas"
  | "gestion";

export interface NavMeta {
  href: string;
  /** Label para el sidebar y el sheet "Más". */
  label: string;
  /** Label corto para la barra mobile (ej. /dashboard -> "Inicio"). */
  shortLabel?: string;
  group: NavGroup;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
  icon: ReactNode;
}

/** Grupos del sidebar, en orden de render. */
export const NAV_GROUPS: { key: NavGroup; label: string | null }[] = [
  { key: "principal", label: null },
  { key: "clientes", label: "Clientes y ventas" },
  { key: "propiedades", label: "Propiedades" },
  { key: "alquileres", label: "Alquileres" },
  { key: "finanzas", label: "Finanzas" },
  { key: "gestion", label: "Gestión" },
];

/** Una entrada por href navegable/favoriteable, en orden de menú. */
export const NAV_META_LIST: NavMeta[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Inicio",
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
    shortLabel: "Contactos",
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
    shortLabel: "Contactos+",
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
    shortLabel: "Consultas",
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
    shortLabel: "Seguim.",
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
    shortLabel: "Agenda",
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
    shortLabel: "Props.",
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
    shortLabel: "Tasac.",
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
    shortLabel: "Firmas",
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
    shortLabel: "Alquil.",
    group: "alquileres",
    adminOnly: true,
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
    shortLabel: "Inquil.",
    group: "alquileres",
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/estados-cuenta",
    label: "Estados de cuenta",
    shortLabel: "Cuentas",
    group: "finanzas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M16 14h2" />
      </svg>
    ),
  },
  {
    href: "/objetivos",
    label: "Objetivos",
    shortLabel: "Objetivos",
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
    shortLabel: "Objetivos",
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
    href: "/configuracion",
    label: "Configuración",
    shortLabel: "Config.",
    group: "gestion",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

/** Mapa href -> NavMeta para lookup O(1). */
export const NAV_META: Record<string, NavMeta> = Object.fromEntries(
  NAV_META_LIST.map((m) => [m.href, m])
);

/** Fallback de tabs mobile cuando el usuario no tiene favoritos. */
export const DEFAULT_MOBILE_TABS = ["/dashboard", "/contactos", "/agenda", "/propiedades"];

export function getNavMeta(href: string): NavMeta | undefined {
  return NAV_META[href];
}
