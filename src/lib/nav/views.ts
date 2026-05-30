// ────────────────────────────────────────────────────────────────────
// Registro canónico de vistas del sistema para control de acceso.
// Es la fuente de verdad de qué rutas se pueden conceder a un usuario.
// Los componentes de navegación filtran sus ítems contra este acceso.
// ────────────────────────────────────────────────────────────────────

export interface AppView {
  href: string;
  label: string;
  /** Siempre accesible para cualquier usuario logueado (no se puede quitar). */
  always?: boolean;
  /** Solo accesible para admins; no se concede a usuarios comunes. */
  adminOnly?: boolean;
}

export const APP_VIEWS: AppView[] = [
  { href: "/dashboard", label: "Dashboard", always: true },
  { href: "/contactos", label: "Contactos" },
  { href: "/consultants", label: "Últimos contactos" },
  { href: "/consultants-followups", label: "Seg. consultas" },
  { href: "/seguimientos", label: "Seguimientos" },
  { href: "/agenda", label: "Agenda" },
  { href: "/propiedades", label: "Propiedades" },
  { href: "/tasaciones", label: "Tasaciones" },
  { href: "/firmas", label: "Estado de firmas" },
  { href: "/alquileres", label: "Alquileres" },
  { href: "/inquilinos", label: "Inquilinos" },
  { href: "/estados-cuenta", label: "Estados de cuenta" },
  { href: "/objetivos", label: "Objetivos" },
  { href: "/mis-objetivos", label: "Mis objetivos" },
  { href: "/adicionales", label: "Adicionales", adminOnly: true },
  { href: "/miembros", label: "Miembros", adminOnly: true },
  { href: "/configuracion", label: "Configuración", adminOnly: true },
];

/** Vistas que un admin puede conceder/quitar a un usuario común. */
export const GRANTABLE_VIEWS: AppView[] = APP_VIEWS.filter((v) => !v.always && !v.adminOnly);

/** Hrefs siempre accesibles para cualquier usuario logueado. */
export const ALWAYS_ALLOWED_HREFS: string[] = APP_VIEWS.filter((v) => v.always).map((v) => v.href);

const GRANTABLE_HREFS = new Set(GRANTABLE_VIEWS.map((v) => v.href));

/**
 * Conjunto de hrefs accesibles para un usuario.
 * - Admin: todo.
 * - No admin: vistas siempre permitidas + las concedidas (solo las grantables).
 */
export function computeAccessibleHrefs(isAdmin: boolean, allowedViews: string[] | null | undefined): Set<string> {
  if (isAdmin) return new Set(APP_VIEWS.map((v) => v.href));
  const granted = (allowedViews ?? []).filter((href) => GRANTABLE_HREFS.has(href));
  return new Set([...ALWAYS_ALLOWED_HREFS, ...granted]);
}

/** Devuelve la vista del registro que corresponde a un pathname (match por prefijo más largo). */
export function matchView(pathname: string): AppView | null {
  let best: AppView | null = null;
  for (const v of APP_VIEWS) {
    if (pathname === v.href || pathname.startsWith(`${v.href}/`)) {
      if (!best || v.href.length > best.href.length) best = v;
    }
  }
  return best;
}

/**
 * ¿El usuario puede acceder a este pathname?
 * - Rutas que no corresponden a ninguna vista conocida: permitidas (no se bloquean).
 * - Vistas adminOnly: solo admin.
 * - Resto: debe estar en el conjunto accesible.
 */
export function isPathAllowed(pathname: string, accessible: Set<string>, isAdmin: boolean): boolean {
  const view = matchView(pathname);
  if (!view) return true;
  if (view.adminOnly) return isAdmin;
  return accessible.has(view.href);
}
