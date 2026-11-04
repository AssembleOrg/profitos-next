"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import type { TrendPoint } from "@/lib/web/server/insights";

const METRICS = [
  ["visitors", "Personas"],
  ["sessions", "Sesiones"],
  ["propertyViews", "Fichas vistas"],
  ["searches", "Búsquedas"],
  ["contacts", "Consultas"],
] as const;
type Metric = (typeof METRICS)[number][0];

const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}

/** Una métrica a la vez, nunca dos escalas. El período anterior va punteado, en la misma escala. */
export function TrendChart({ points, previous }: { points: TrendPoint[]; previous: TrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>("visitors");
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // El dibujo usa el ancho real: la letra y las líneas no se achican en el celular.
  const [WIDTH, setWidth] = useState(900);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(element.clientWidth, 280));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { line, prevLine, area, max, xOf, yOf } = useMemo(() => {
    const values = points.map((point) => point[metric]);
    const prevValues = previous.map((point) => point[metric]);
    const top = niceMax(Math.max(...values, ...prevValues, 1));
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const x = (index: number) => PAD.left + (points.length > 1 ? (index / (points.length - 1)) * plotWidth : plotWidth / 2);
    const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
    const path = (series: number[]) => series.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
    return {
      line: path(values),
      prevLine: path(prevValues),
      area: values.length > 1 ? `${path(values)} L${x(values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z` : "",
      max: top,
      xOf: x,
      yOf: y,
    };
  }, [WIDTH, metric, points, previous]);

  const label = METRICS.find(([key]) => key === metric)?.[1] ?? "";
  const current = hover === null ? null : points[hover];
  const prior = hover === null ? null : previous[hover];
  const ticks = [0, max / 2, max];
  const every = Math.max(1, Math.ceil(points.length / Math.max(Math.floor(WIDTH / 90), 2)));

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (position - PAD.left) / (WIDTH - PAD.left - PAD.right);
    setHover(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1" role="group" aria-label="Métrica del gráfico">
        {METRICS.map(([key, text]) => (
          <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)} className={`min-h-9 rounded-full px-3 text-[13px] ${metric === key ? "bg-text font-medium text-bg" : "text-text-muted hover:bg-surface-elevated"}`}>
            {text}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-[12.5px] text-text-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-text" />Período</span>
          <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-text-faint" />Anterior</span>
        </span>
      </div>
      <div className="relative" ref={box}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full touch-pan-y" role="img" aria-label={`${label} por día`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--color-border)" strokeWidth="1" />
              <text x={PAD.left - 8} y={yOf(tick) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-faint)">{Math.round(tick)}</text>
            </g>
          ))}
          {points.map((point, index) => (index % every === 0 ? (
            <text key={point.day} x={xOf(index)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--color-text-faint)">{DateTime.fromISO(point.day).toFormat("dd/MM")}</text>
          ) : null))}
          {area && <path d={area} fill="var(--color-text)" opacity="0.05" />}
          <path d={prevLine} fill="none" stroke="var(--color-text-faint)" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d={line} fill="none" stroke="var(--color-text)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.length === 1 && <circle cx={xOf(0)} cy={yOf(points[0][metric])} r="4" fill="var(--color-text)" />}
          {current && hover !== null && (
            <g>
              <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--color-text-faint)" strokeWidth="1" />
              <circle cx={xOf(hover)} cy={yOf(current[metric])} r="4.5" fill="var(--color-text)" stroke="var(--color-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
        {current && hover !== null && (
          <div className="pointer-events-none absolute top-1 rounded-lg bg-text px-2.5 py-1.5 text-[12px] text-bg shadow-lg" style={{ left: `${(xOf(hover) / WIDTH) * 100}%`, transform: hover > points.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}>
            <div className="font-medium">{DateTime.fromISO(current.day).toFormat("dd/MM/yyyy")}</div>
            <div className="tabular-nums">{label}: {current[metric]}</div>
            {prior && <div className="tabular-nums opacity-70">Anterior: {prior[metric]}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
