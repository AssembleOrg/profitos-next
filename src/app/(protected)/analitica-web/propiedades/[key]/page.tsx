import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getCurrentAccess } from "@/lib/auth/access";
import { WEB_BASE } from "@/lib/web/format";
import { formatArgentinePhone } from "@/lib/web/phone";
import { getPropertyViewers, resolveRange, type InsightFilters } from "@/lib/web/server/insights";
import { EmptyState, formatDuration, Panel } from "../../_components/ui";

export const metadata = { title: "Propiedad | Analítica web" };

export default async function PropertyInsightsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getCurrentAccess();
  if (!access?.isAdmin) redirect("/dashboard");
  const key = decodeURIComponent((await params).key);
  const raw = await searchParams;
  const filters = Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === "string")) as InsightFilters;
  const range = resolveRange(filters);
  const { address, subtitle, viewers } = await getPropertyViewers(key, filters, range);
  const back = new URLSearchParams({ ...(filters as Record<string, string>), tab: "propiedades" }).toString();

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-3 md:gap-4">
      <Link href={`/analitica-web?${back}`} className="min-h-11 self-start py-2 text-[13.5px] font-medium text-text-muted hover:text-text">← Propiedades</Link>
      <header>
        <h1 className="font-display text-[22px] font-semibold leading-tight text-text [overflow-wrap:anywhere] sm:text-[26px]">{address}</h1>
        <p className="mt-1 text-[13.5px] text-text-muted">{subtitle ? `${subtitle} · ` : ""}del {range.label} · <a href={`${WEB_BASE}/p/${encodeURIComponent(key)}-ficha`} target="_blank" rel="noreferrer" className="underline underline-offset-2">Ver ficha</a></p>
      </header>
      <Panel title="Quién la miró" subtitle={`${viewers.length} ${viewers.length === 1 ? "persona" : "personas"}, de quien más tiempo le dedicó a quien menos`}>
        {viewers.length === 0 ? <EmptyState>Nadie la miró en este período con estos filtros.</EmptyState> : (
          <ul className="flex flex-col divide-y divide-border">
            {viewers.map((viewer) => (
              <li key={`${viewer.id}-${viewer.registered}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-[13.5px]">
                <span className="min-w-0">
                  <Link href={`/analitica-web/personas/${encodeURIComponent(viewer.id)}`} className="font-medium text-text hover:underline">{viewer.name ?? viewer.email ?? `Anónimo ${viewer.id.slice(0, 6)}`}</Link>
                  {viewer.phone && <a className="ml-2 text-text-muted underline underline-offset-2" href={`https://wa.me/${viewer.phone}`} target="_blank" rel="noreferrer">{formatArgentinePhone(viewer.phone)}</a>}
                </span>
                <span className="text-right tabular-nums text-text-muted">
                  {formatDuration(viewer.seconds)} · {viewer.visits} {viewer.visits === 1 ? "visita" : "visitas"}{viewer.photos ? ` · ${viewer.photos} fotos` : ""}{viewer.favorited ? " · Favorita" : ""}{viewer.contacted ? " · Consultó" : ""} · {DateTime.fromISO(viewer.lastSeen).toFormat("dd/MM HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
