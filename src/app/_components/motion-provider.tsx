"use client";

import { MotionConfig } from "framer-motion";
import { T_BASE } from "@/lib/motion";

/**
 * Configuración de movimiento para toda la app (staff, portal de inquilinos y
 * login).
 *
 * - reducedMotion="user": con "reducir movimiento" activo en el sistema,
 *   framer-motion saca traslados, escalas y layout; conserva opacidad y color.
 * - transition por defecto = la del mundo (200ms, salida exponencial). Las
 *   animaciones que no declaran la suya dejan de usar el resorte por defecto de
 *   framer, que rebota (DESIGN.md: sin rebotes).
 */
export function MotionProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <MotionConfig reducedMotion="user" transition={T_BASE}>
      {children}
    </MotionConfig>
  );
}
