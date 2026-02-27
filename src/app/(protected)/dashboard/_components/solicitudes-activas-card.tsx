export function SolicitudesActivasCard() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-secondary" />
          <span className="text-xs font-semibold tracking-widest text-secondary uppercase">
            Solicitudes Activas
          </span>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-[10px] font-medium tracking-wider text-text-muted uppercase">
          Tiempo Real
        </span>
      </div>

      {/* Big number */}
      <div className="mt-4">
        <p className="text-7xl font-extralight tracking-tight text-text">24</p>
      </div>

      {/* Subtitle */}
      <p className="mt-2 text-sm text-text-muted">
        solicitudes en gestión activa
      </p>

      {/* Stats row */}
      <div className="mt-6 flex gap-8">
        <div>
          <p className="text-xl font-medium text-text">18</p>
          <p className="text-xs text-text-muted">En proceso</p>
        </div>
        <div>
          <p className="text-xl font-medium text-text">4</p>
          <p className="text-xs text-text-muted">Aprobadas</p>
        </div>
        <div>
          <p className="text-xl font-medium text-text">2</p>
          <p className="text-xs text-text-muted">Pendientes</p>
        </div>
      </div>
    </div>
  );
}
