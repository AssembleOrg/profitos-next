const solicitudes = [
  {
    nombre: "Carlos Mendez",
    detalle: "Dpto 3 amb · Palermo Hollywood",
    tiempo: "2h",
  },
  {
    nombre: "Marta López",
    detalle: "Casa 4 amb · San Isidro",
    tiempo: "5h",
  },
  {
    nombre: "Roberto Fernández",
    detalle: "PH dúplex · Belgrano",
    tiempo: "1d",
  },
  {
    nombre: "Ana García",
    detalle: "Oficina · Microcentro",
    tiempo: "2d",
  },
];

export function UltimasSolicitudesCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold tracking-widest text-text uppercase">
            Últimas Solicitudes
          </h3>
          <span className="rounded-full bg-secondary/20 px-2.5 py-0.5 text-[10px] font-medium text-secondary">
            4 nuevas
          </span>
        </div>
        <button className="text-xs text-text-muted transition-colors hover:text-text">
          Ver todo →
        </button>
      </div>

      {/* List */}
      <div className="mt-6 flex flex-col">
        {solicitudes.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-border/50 py-4 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-secondary/60" />
              <div>
                <p className="text-sm font-medium text-text">{s.nombre}</p>
                <p className="text-xs text-text-muted">{s.detalle}</p>
              </div>
            </div>
            <span className="text-xs text-text-muted">{s.tiempo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
