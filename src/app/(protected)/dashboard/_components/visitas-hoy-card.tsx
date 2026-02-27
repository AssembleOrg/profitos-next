export function VisitasHoyCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-text-muted uppercase">
          Visitas Hoy
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <p className="mt-3 text-4xl font-light tracking-tight text-text">12</p>
      <div className="mt-1 border-t border-border pt-2">
        <span className="text-xs text-text-muted">próx. 14:30</span>
      </div>
    </div>
  );
}
