const visitas = [
  {
    hora: "HOY · 14:30",
    propiedad: "Depto 4amb - Av. Libertador",
    cliente: "Carlos Mendez",
    estado: "Confirm.",
    estadoColor: "bg-secondary/20 text-secondary",
    img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=120&h=80&fit=crop",
  },
  {
    hora: "HOY · 17:00",
    propiedad: "Casa jardín - San Isidro",
    cliente: "Marta López",
    estado: "Pendiente",
    estadoColor: "bg-amber-500/20 text-amber-400",
    img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=120&h=80&fit=crop",
  },
  {
    hora: "MAÑANA · 10:00",
    propiedad: "Oficina premium - Microcentro",
    cliente: "Roberto Fernández",
    estado: "Pendiente",
    estadoColor: "bg-amber-500/20 text-amber-400",
    img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=120&h=80&fit=crop",
  },
];

export function ProximasVisitasCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-widest text-text uppercase">
          Próximas Visitas
        </h3>
        <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface hover:text-text">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Agendar
        </button>
      </div>

      {/* Visits list */}
      <div className="mt-5 flex flex-col gap-4">
        {visitas.map((v, i) => (
          <div
            key={i}
            className="flex flex-col gap-2.5 rounded-xl bg-bg/50 p-3"
          >
            {/* Top row: image + info */}
            <div className="flex items-center gap-3">
              <img
                src={v.img}
                alt={v.propiedad}
                className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[10px] font-semibold tracking-wider text-text-muted">
                  {v.hora}
                </span>
                <p className="truncate text-sm font-medium text-text">{v.propiedad}</p>
                <p className="truncate text-xs text-text-muted">{v.cliente}</p>
              </div>
            </div>
            {/* Badge — bottom of card */}
            <div className="flex justify-end">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${v.estadoColor}`}
              >
                {v.estado}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
