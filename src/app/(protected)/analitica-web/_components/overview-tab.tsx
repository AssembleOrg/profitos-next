import type { getOverview, Kpis } from "@/lib/web/server/insights";
import { TrendChart } from "./trend-chart";
import { BarList, formatDuration, Panel } from "./ui";

type Data = Awaited<ReturnType<typeof getOverview>>;

const DEVICES: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computadora" };
const OPERATIONS: Record<string, string> = { venta: "Venta", alquiler: "Alquiler", temporario: "Temporario" };

function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before) return <span className="text-[12px] text-text-faint">{now ? "Sin dato anterior" : "Sin cambios"}</span>;
  const change = (now - before) / before;
  const up = change >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`text-[12px] font-medium tabular-nums ${change === 0 ? "text-text-faint" : good ? "text-olive-light" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(change * 100))}% <span className="font-normal text-text-faint">vs. anterior</span>
    </span>
  );
}

function Tile({ label, value, now, before, hint }: { label: string; value: string; now: number; before: number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-3.5 md:p-4" title={hint}>
      <p className="text-[12.5px] text-text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] font-bold leading-tight tabular-nums text-text md:text-[26px]">{value}</p>
      <Delta now={now} before={before} />
    </div>
  );
}

function tiles(current: Kpis, previous: Kpis) {
  const format = (value: number) => value.toLocaleString("es-AR");
  return [
    { label: "Personas", value: format(current.visitors), now: current.visitors, before: previous.visitors, hint: "Navegadores o cuentas distintas" },
    { label: "Sesiones", value: format(current.sessions), now: current.sessions, before: previous.sessions, hint: "Se corta tras 30 minutos sin actividad" },
    { label: "Fichas vistas", value: format(current.propertyViews), now: current.propertyViews, before: previous.propertyViews },
    { label: "Tiempo medio en ficha", value: formatDuration(current.avgPropertySeconds), now: current.avgPropertySeconds, before: previous.avgPropertySeconds, hint: "Solo con la pestaña a la vista y actividad en el último minuto" },
    { label: "Búsquedas", value: format(current.searches), now: current.searches, before: previous.searches },
    { label: "Consultas", value: format(current.contacts), now: current.contacts, before: previous.contacts, hint: "WhatsApp, teléfono, email y formularios" },
    { label: "Personas que consultan", value: `${(current.conversion * 100).toFixed(1)}%`, now: current.conversion, before: previous.conversion },
    { label: "Registros nuevos", value: format(current.registrations), now: current.registrations, before: previous.registrations },
  ];
}

export function OverviewTab({ data, rangeDays }: { data: Data; rangeDays: number }) {
  const { current, previous, points, previousPoints, steps } = data;
  const first = steps[0]?.people ?? 0;
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles(current, previous).map((tile) => <Tile key={tile.label} {...tile} />)}
      </div>

      <Panel title="Evolución" subtitle={`Por día, contra los ${rangeDays} días anteriores`}>
        <TrendChart points={points} previous={previousPoints} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recorrido" subtitle="Personas que llegaron a cada paso">
          <BarList items={steps.map((step) => ({ name: step.label, people: step.people }))} total={first} />
        </Panel>
        <Panel title="De dónde llegan">
          <BarList items={data.channels} total={current.visitors} />
        </Panel>
        <Panel title="Dispositivo">
          <BarList items={data.devices.map((item) => ({ ...item, name: DEVICES[item.name] ?? item.name }))} total={current.visitors} />
        </Panel>
        <Panel title="Navegador">
          <BarList items={data.browsers} total={current.visitors} />
        </Panel>
        <Panel title="Operación que miran">
          <BarList items={data.operations.map((item) => ({ ...item, name: OPERATIONS[item.name] ?? item.name }))} />
        </Panel>
        <Panel title="Tipo que miran">
          <BarList items={data.types} />
        </Panel>
        <Panel title="Zonas que miran">
          <BarList items={data.zones} />
        </Panel>
      </div>
    </div>
  );
}
