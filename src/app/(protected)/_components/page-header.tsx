import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Encabezado de vista (patrón para todas las pantallas del sistema).
 * Celular: título arriba y, debajo, una fila de acciones compactas (h-9) con la
 * principal a la derecha. Desde sm: título a la izquierda y acciones a la derecha.
 * Las acciones usan `headerAction` / `headerPrimary` para que midan lo mismo en todas las vistas.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}>) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="text-[12.5px] font-semibold text-text-faint hover:text-text">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-[22px] font-semibold leading-tight text-text sm:text-[26px] md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-text-faint">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">{actions}</div>}
    </header>
  );
}

/** Acción secundaria del encabezado. */
export const headerAction =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text sm:h-11 sm:px-4.5 sm:text-[13.5px]";

/** Acción principal: en el celular se va a la derecha de la fila. */
export const headerPrimary =
  "ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-dark px-4 text-[12.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 sm:ml-0 sm:h-11 sm:px-5 sm:text-[13.5px]";
