import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getCurrentAccess } from "@/lib/auth/access";
import { WEB_BASE } from "@/lib/web/format";
import { formatArgentinePhone } from "@/lib/web/phone";
import { getPerson, type TimelineEvent } from "@/lib/web/server/insights";
import { formatDuration, Panel } from "../../_components/ui";

export const metadata = { title: "Persona | Analítica web" };

function describe(event: TimelineEvent): string {
  const where = event.address ?? event.path ?? "";
  switch (event.type) {
    case "page_view":
      return event.propertyKey ? `Vio ${where}` : `Entró a ${(event.path ?? "").replace(WEB_BASE, "") || "inicio"}`;
    case "search": {
      const parts = Object.entries(event.filters ?? {}).filter(([key]) => key !== "orden").map(([, value]) => value);
      if (event.query) parts.push(`“${event.query}”`);
      return `Buscó ${parts.join(" · ") || "sin filtros"} (${event.results ?? 0} resultados)`;
    }
    case "photo_open": return `Abrió fotos de ${where}`;
    case "video_play": return `Reprodujo el video de ${where}`;
    case "favorite_add": return `Guardó ${where}`;
    case "favorite_remove": return `Quitó de favoritas ${where}`;
    case "whatsapp_click": return `Tocó WhatsApp${event.address ? ` en ${event.address}` : ""}`;
    case "phone_click": return `Tocó llamar${event.address ? ` en ${event.address}` : ""}`;
    case "email_click": return "Tocó el email";
    case "form_submit": return `Envió el formulario${event.label ? ` de ${event.label.toLowerCase()}` : ""}`;
    case "development_click": return `Consultó por ${event.label ?? "un emprendimiento"}`;
    case "login": return event.label === "primer ingreso" ? "Se registró con Google" : "Ingresó con Google";
    case "phone_added": return "Dejó su celular";
    case "filters_open": return "Abrió los filtros";
    default: return event.type;
  }
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getCurrentAccess();
  if (!access?.isAdmin) redirect("/dashboard");
  const { id } = await params;
  const person = await getPerson(decodeURIComponent(id));
  if (!person) notFound();
  const { visitor, timeline, topProperties } = person;

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 pb-24 pt-4 md:px-6">
      <Link href="/analitica-web?tab=personas" className="min-h-11 self-start py-2 text-[13.5px] font-medium text-text-muted hover:text-text">← Personas</Link>
      <header>
        <h1 className="font-display text-[26px] font-semibold text-text">{visitor?.name ?? visitor?.email ?? `Anónimo ${decodeURIComponent(id).slice(0, 6)}`}</h1>
        {visitor ? (
          <p className="mt-1 flex flex-wrap gap-x-3 text-[13.5px] text-text-muted">
            <span>{visitor.email}</span>
            {visitor.phone ? <a className="font-medium text-text underline underline-offset-2" href={`https://wa.me/${visitor.phone}`} target="_blank" rel="noreferrer">{formatArgentinePhone(visitor.phone)}</a> : <span>Sin celular</span>}
            <span>{visitor.logins} {visitor.logins === 1 ? "ingreso" : "ingresos"}</span>
            <span>Novedades por email: {visitor.marketing ? "aceptó" : "no aceptó"}</span>
          </p>
        ) : <p className="mt-1 text-[13.5px] text-text-muted">No ingresó con Google: es un navegador, sin nombre ni contacto.</p>}
      </header>

      {topProperties.length > 0 && (
        <Panel title="Lo que más miró">
          <ul className="flex flex-col divide-y divide-border">
            {topProperties.map((item) => (
              <li key={item.key} className="flex items-baseline justify-between gap-3 py-2 text-[13.5px]">
                <a href={`${WEB_BASE}/p/${item.key}-ficha`} target="_blank" rel="noreferrer" className="font-medium text-text hover:underline">{item.address}</a>
                <span className="whitespace-nowrap tabular-nums text-text-muted">{formatDuration(item.seconds)} · {item.visits} {item.visits === 1 ? "visita" : "visitas"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Actividad" subtitle="Las últimas 500 acciones, de la más reciente a la más antigua">
        <ol className="flex flex-col divide-y divide-border">
          {timeline.map((event) => (
            <li key={event.id} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-2 text-[13.5px]">
              <time className="tabular-nums text-text-muted">{DateTime.fromISO(event.at).toFormat("dd/MM HH:mm")}</time>
              <span className="text-text">
                {describe(event)}
                {event.type === "page_view" && event.durationSeconds > 0 && <span className="text-text-muted"> · {formatDuration(event.durationSeconds)}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
