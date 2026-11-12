import type { ReactNode } from "react";

export function Panel({ title, subtitle, children, action }: { title?: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-3.5 md:p-5">
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-[16px] font-semibold text-text">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[12.5px] text-text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-bg px-4 py-8 text-center text-[13.5px] text-text-muted">{children}</p>;
}

/** Lista de barras horizontales: una sola serie y el valor siempre escrito. */
export function BarList({ items, total, unit = "personas" }: { items: { name: string; people: number }[]; total?: number; unit?: string }) {
  if (!items.length) return <EmptyState>Sin datos en este período.</EmptyState>;
  const max = Math.max(...items.map((item) => item.people), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
          <span className="truncate text-[13.5px] text-text">{item.name}</span>
          <span className="text-[13px] font-medium tabular-nums text-text" title={`${item.people} ${unit}`}>
            {item.people.toLocaleString("es-AR")}
            {total ? <span className="ml-1.5 font-normal text-text-muted">{Math.round((item.people / total) * 100)}%</span> : null}
          </span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-bg">
            <span className="block h-full rounded-full bg-text" style={{ width: `${Math.max((item.people / max) * 100, 2)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "0 s";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}
