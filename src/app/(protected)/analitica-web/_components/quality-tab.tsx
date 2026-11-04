import { DateTime } from "luxon";
import type { getQuality } from "@/lib/web/server/insights";
import { BarList, Panel } from "./ui";

const LABELS: Record<string, string> = {
  page_view: "Páginas vistas",
  search: "Búsquedas",
  photo_open: "Fotos abiertas",
  video_play: "Videos reproducidos",
  favorite_add: "Favoritas agregadas",
  favorite_remove: "Favoritas quitadas",
  whatsapp_click: "Clics en WhatsApp",
  phone_click: "Clics en teléfono",
  email_click: "Clics en email",
  form_submit: "Formularios enviados",
  filters_open: "Filtros abiertos",
  login: "Ingresos con Google",
  phone_added: "Celulares cargados",
  development_click: "Consultas por emprendimientos",
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[12.5px] text-text-muted">{label}</p>
      <p className="mt-1 font-display text-[24px] font-bold tabular-nums text-text">{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-text-faint">{note}</p>}
    </div>
  );
}

export function QualityTab({ data }: { data: Awaited<ReturnType<typeof getQuality>> }) {
  const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "0%");
  const counted = data.total - data.bots - data.internal;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Último evento" value={data.lastEvent ? DateTime.fromISO(data.lastEvent).toFormat("dd/MM HH:mm") : "Sin datos"} note="Si queda viejo, algo dejó de registrar" />
        <Stat label="Eventos contados" value={counted.toLocaleString("es-AR")} note={`de ${data.total.toLocaleString("es-AR")} recibidos`} />
        <Stat label="Bots descartados" value={data.bots.toLocaleString("es-AR")} />
        <Stat label="Del equipo descartados" value={data.internal.toLocaleString("es-AR")} note="Solo si ingresó con su cuenta" />
        <Stat label="Eventos identificados" value={percent(data.identified, data.total - data.bots)} note="Con persona registrada" />
        <Stat label="Páginas sin tiempo" value={percent(data.noTime, data.pageViews)} note="Se fueron enseguida o se perdió el último aviso" />
        <Stat label="Registrados con celular" value={percent(data.withPhone, data.registered)} note={`${data.withPhone} de ${data.registered}`} />
        <Stat label="Aceptaron novedades" value={percent(data.marketing, data.registered)} note={`${data.marketing} de ${data.registered}`} />
      </div>
      <Panel title="Eventos por tipo" subtitle="Cada acción se guarda una sola vez, con hora del servidor">
        <BarList items={data.byType.map((item) => ({ name: LABELS[item.type] ?? item.type, people: item.count }))} unit="eventos" />
      </Panel>
      <Panel title="Qué tener en cuenta">
        <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] text-text-muted">
          <li>Una persona anónima es un navegador: la misma en celular y computadora cuenta dos veces hasta que ingresa con Google.</li>
          <li>Los bloqueadores de publicidad y algunos navegadores pueden reducir lo registrado.</li>
          <li>El equipo solo se descuenta si ingresó a la web con su cuenta de la lista de acceso.</li>
          <li>Los filtros de operación, tipo y zona solo alcanzan eventos con esos datos: fichas y búsquedas.</li>
        </ul>
      </Panel>
    </div>
  );
}
