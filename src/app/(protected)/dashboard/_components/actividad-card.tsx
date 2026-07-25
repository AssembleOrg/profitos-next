const actividades = [
  {
    tiempo: "Hace 15 min",
    texto: "Nueva solicitud recibida",
    tag: "Solicitud",
    tagColor: "bg-secondary/20 text-secondary",
  },
  {
    tiempo: "Hace 1h",
    texto: "Visita confirmada por cliente",
    tag: "Visita",
    tagColor: "bg-info-chip text-info",
  },
  {
    tiempo: "Hace 3h",
    texto: "Contrato enviado para firma",
    tag: "Contrato",
    tagColor: "bg-warning-chip text-warning",
  },
  {
    tiempo: "Ayer",
    texto: "Propiedad publicada en portal",
    tag: "Propiedad",
    tagColor: "bg-olive-chip text-olive-light",
  },
];

export function ActividadCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-widest text-text uppercase">
          Actividad
        </h3>
        <span className="h-2 w-2 rounded-full bg-secondary" />
      </div>

      {/* Timeline */}
      <div className="mt-6 flex flex-col gap-6">
        {actividades.map((a, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium tracking-wider text-text-muted uppercase">
              {a.tiempo}
            </span>
            <p className="text-sm text-text">{a.texto}</p>
            <span
              className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${a.tagColor}`}
            >
              {a.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
