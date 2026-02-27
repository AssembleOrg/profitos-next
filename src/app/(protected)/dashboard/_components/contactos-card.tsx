export function ContactosCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-text-muted uppercase">
          Contactos
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      </div>
      <p className="mt-3 text-4xl font-light tracking-tight text-text">
        1,284
      </p>
      <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
        <span className="text-xs text-secondary">+8</span>
      </div>
    </div>
  );
}
