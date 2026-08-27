"use client";

import type { SelectHTMLAttributes } from "react";

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Clases extra para el contenedor (ancho, flex, etc.). */
  wrapperClassName?: string;
};

/**
 * Selector V4: mantiene el `<select>` nativo por accesibilidad y comportamiento
 * en mobile, pero oculta su chrome (`appearance-none`) y dibuja el chevron y la
 * caja con el lenguaje visual del sistema.
 */
export function SelectField({
  className = "",
  wrapperClassName = "",
  ...props
}: Readonly<SelectFieldProps>) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`h-11 w-full cursor-pointer appearance-none rounded-[14px] border border-border bg-surface pl-3.5 pr-10 text-[13.5px] font-medium text-text outline-none transition-colors hover:bg-bg focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      />
      <svg
        aria-hidden
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-text-faint"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
