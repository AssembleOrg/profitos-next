import Link from "next/link";

interface Props {
  count: number;
}

export function SeguimientosVencidosCard({ count }: Props) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-text-muted uppercase">
          Seguimientos Vencidos
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <p className="mt-3 text-4xl font-light tracking-tight text-text">{count}</p>
      <div className="mt-1 border-t border-border pt-2">
        <Link href="/seguimientos" className="text-xs text-danger transition-colors hover:text-danger">
          Revisar vencidos
        </Link>
      </div>
    </div>
  );
}
