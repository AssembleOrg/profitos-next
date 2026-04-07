import Link from "next/link";

interface Props {
  count: number;
}

export function SeguimientosPendientesCard({ count }: Props) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-text-muted uppercase">
          Mis Seguimientos
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </div>
      <p className="mt-3 text-4xl font-light tracking-tight text-text">{count}</p>
      <div className="mt-1 border-t border-border pt-2">
        <Link href="/seguimientos" className="text-xs text-secondary transition-colors hover:text-secondary/80">
          Ver pendientes
        </Link>
      </div>
    </div>
  );
}
