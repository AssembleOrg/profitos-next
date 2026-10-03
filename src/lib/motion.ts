/**
 * Lenguaje de movimiento de Profitos (V4 · Cálido Expresivo).
 *
 * DESIGN.md fija las reglas: transiciones de 150–200ms con salida exponencial,
 * sin rebotes, las cifras no bailan y "el dorado marca lo que cambia". Este
 * módulo es la única fuente de esos valores para framer-motion; los mismos
 * tiempos existen como variables CSS (--ease-out, --dur-*) en globals.css.
 */

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const DUR = {
  /** Acuse inmediato de una acción. */
  fast: 0.15,
  /** Cambio de estado de rutina. */
  base: 0.2,
  /** Overlay, panel o cambio de layout. */
  layout: 0.3,
} as const;

export const T_BASE = { duration: DUR.base, ease: EASE_OUT };
export const T_LAYOUT = { duration: DUR.layout, ease: EASE_OUT };

/**
 * Resorte con amortiguamiento crítico (ζ = 1): llega firme y se queda, sin
 * overshoot. Reemplaza al stiffness 400 / damping 30 (ζ = 0.75) que rebotaba.
 */
export const SPRING_SETTLE = { type: "spring" as const, stiffness: 400, damping: 40 };

/** Tope del escalonado de listas: más allá de N ítems todos entran juntos. */
export function staggerDelay(index: number, step = 0.03, cap = 8): number {
  return Math.min(index, cap) * step;
}

// ── Marca de cambio ──────────────────────────────────────────────────────
//
// Cuando un dato cambia sin que la persona lo esté mirando (lo hizo el chat,
// lo terminó el worker, lo guardó un modal), su fila o tarjeta se enciende con
// un contorno dorado y un lavado arena que se apagan solos (ver [data-changed]
// en globals.css). Es color, no desplazamiento: las cifras no se mueven.

/** Ventana en la que un ítem que aparece se considera "nuevo por el refresco". */
const NEW_ITEM_WINDOW_MS = 6000;

let refreshEpoch = { at: 0, path: "" };

/**
 * Avisa que la pantalla se va a refrescar por algo externo (p. ej. una acción
 * del chat). Los ítems que monten en los segundos siguientes, en esta misma
 * ruta, se marcan como nuevos.
 */
export function noteDataRefresh(): void {
  refreshEpoch = { at: Date.now(), path: window.location.pathname };
}

function justRefreshedHere(): boolean {
  return (
    Date.now() - refreshEpoch.at < NEW_ITEM_WINDOW_MS &&
    window.location.pathname === refreshEpoch.path
  );
}

function clearMark(e: AnimationEvent): void {
  if (e.animationName === "pf-change") (e.currentTarget as Element).removeAttribute("data-changed");
}

/** Enciende la marca dorada sobre `el`; si ya estaba corriendo, la reinicia. */
export function flashChange(el: HTMLElement): void {
  el.removeAttribute("data-changed");
  void el.offsetWidth; // reflow: reinicia la animación aunque el atributo ya estuviera
  el.setAttribute("data-changed", "");
  // Misma referencia de función → el navegador no la registra dos veces.
  el.addEventListener("animationend", clearMark);
  el.addEventListener("animationcancel", clearMark);
}

const fingerprints = new WeakMap<Element, string>();

/**
 * Ref para filas y tarjetas de listas. Marca el ítem cuando su `fingerprint`
 * (los campos que muestra) cambia, o cuando aparece justo después de un
 * refresco externo. No usa hooks, así que sirve dentro de un `.map()`:
 *
 *   <tr key={r.id} ref={changeMark(`${r.id}|${r.status}|${r.total}`)}>
 *
 * El montaje inicial de la página no marca nada.
 *
 * En componentes `motion.*` framer-motion guarda el ref externo y sólo lo
 * invoca al montar/desmontar: ahí sólo se detectan ítems nuevos, así que basta
 * pasar el id (`changeMark(x.id)`). Para detectar cambios de datos, usar el ref
 * en un elemento DOM común.
 */
export function changeMark(fingerprint: string) {
  return (el: HTMLElement | null): void => {
    if (!el) return;
    const prev = fingerprints.get(el);
    if (prev === fingerprint) return;
    fingerprints.set(el, fingerprint);
    if (prev !== undefined || justRefreshedHere()) flashChange(el);
  };
}
