"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import type { AgendaAdjustment, AgendaDue, AgendaEnding, AgendaMonth } from "@/lib/rentals/dto";
import { Sheet } from "../../_components/sheet";
import { CollectSheet } from "./collect-sheet";
import { AdjustmentSheet, type AdjustmentTarget } from "./adjustment-sheet";
import { IconAlert, IconCalendar, IconChevronLeft, IconChevronRight, IconFlag, IconReceipt, IconSearch, IconTrend } from "./icons";
import {
  DUE_BAR,
  DUE_DOT,
  DuePill,
  Empty,
  btnGold,
  btnPrimarySm,
  btnSecondarySm,
  btnText,
  capitalize,
  dateAR,
  dayLong,
  money,
  moneyShort,
  monthLabel,
  propertyLine,
  shiftMonth,
} from "./kit";

type Filter = "todos" | "a_cobrar" | "vencidos" | "cobrados";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "todos", label: "Todo" },
  { value: "a_cobrar", label: "A cobrar" },
  { value: "vencidos", label: "Vencidos" },
  { value: "cobrados", label: "Cobrados" },
];

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function matches(d: AgendaDue, f: Filter) {
  if (f === "todos") return true;
  if (f === "a_cobrar") return d.status === "esperando" || d.status === "parcial";
  if (f === "vencidos") return d.status === "vencido" || (d.status === "parcial" && d.dueDate < todayStr());
  return d.status === "pagado" || d.status === "condonado";
}

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

function toTarget(a: AgendaAdjustment): AdjustmentTarget {
  return {
    contractId: a.contractId,
    date: a.date,
    index: a.index,
    everyMonths: a.everyMonths,
    currentAmount: a.currentAmount,
    currency: a.currency,
    address: a.property.address,
    unit: a.unit,
    tenantName: a.tenantName,
  };
}

export function AgendaView({ data, q }: { data: AgendaMonth; q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("todos");
  const [collectDue, setCollectDue] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<AdjustmentTarget | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [search, setSearch] = useState(q);
  const [searchOpen, setSearchOpen] = useState(false);

  const inMonth = data.today.startsWith(data.month);
  const firstWithDues = data.dues[0]?.dueDate ?? `${data.month}-01`;
  const [selected, setSelected] = useState(inMonth ? data.today : firstWithDues);
  const [syncedMonth, setSyncedMonth] = useState(data.month);
  if (syncedMonth !== data.month) {
    setSyncedMonth(data.month);
    setSelected(inMonth ? data.today : firstWithDues);
  }

  // Aviso de aumentos: una vez por día, como recordatorio para la admin.
  useEffect(() => {
    if (data.adjustmentsToApply.length === 0) return;
    const key = `alq-aumentos-visto-${data.today}`;
    if (window.localStorage.getItem(key)) return;
    // Diferido: que la agenda cargue primero y el aviso llegue después.
    const t = window.setTimeout(() => {
      window.localStorage.setItem(key, "1");
      setReminderOpen(true);
    }, 500);
    return () => window.clearTimeout(t);
  }, [data.adjustmentsToApply.length, data.today]);

  function navigate(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const dues = useMemo(() => data.dues.filter((d) => matches(d, filter)), [data.dues, filter]);
  const byDay = useMemo(() => {
    const map = new Map<string, { dues: AgendaDue[]; adjustments: AgendaAdjustment[]; endings: AgendaEnding[] }>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { dues: [], adjustments: [], endings: [] });
      return map.get(k)!;
    };
    for (const d of dues) get(d.dueDate).dues.push(d);
    for (const a of data.adjustments) get(a.date).adjustments.push(a);
    for (const e of data.endings) get(e.date).endings.push(e);
    return map;
  }, [dues, data.adjustments, data.endings]);

  const s = data.summary;
  const total = Math.max(1, s.collected + s.pending + s.overdue);
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-4">
      {data.adjustmentsToApply.length > 0 && (
        <AdjustmentStrip items={data.adjustmentsToApply} onApply={(a) => setAdjustTarget(toTarget(a))} />
      )}

      {/* Barra de mes: navegación + búsqueda + filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Mes anterior" onClick={() => navigate({ mes: shiftMonth(data.month, -1) })} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:bg-bg hover:text-text">
            <IconChevronLeft size={18} />
          </button>
          <h2 className="min-w-[150px] text-center font-display text-[20px] font-semibold text-text" aria-live="polite">
            {monthLabel(data.month)}
          </h2>
          <button type="button" aria-label="Mes siguiente" onClick={() => navigate({ mes: shiftMonth(data.month, 1) })} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:bg-bg hover:text-text">
            <IconChevronRight size={18} />
          </button>
          {!inMonth && (
            <button type="button" onClick={() => navigate({ mes: null })} className={btnSecondarySm}>
              Hoy
            </button>
          )}
          {pending && <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-accent" aria-label="Cargando" />}
          <button
            type="button"
            aria-label="Buscar"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
            className={`ml-auto flex h-10 w-10 items-center justify-center rounded-full border sm:hidden ${searchOpen || q ? "border-dark bg-dark text-dark-fg" : "border-border bg-surface text-text-muted"}`}
          >
            <IconSearch size={17} />
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ q: search.trim() || null });
            }}
            className={`h-10 items-center gap-2 rounded-full border border-border bg-surface pl-4 pr-2 focus-within:border-accent sm:flex sm:w-64 ${searchOpen || q ? "flex" : "hidden"}`}
          >
            <IconSearch size={16} className="shrink-0 text-text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => search.trim() !== q && navigate({ q: search.trim() || null })}
              placeholder="Propiedad, inquilino o dueño"
              aria-label="Buscar en la agenda"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
            />
          </form>
          <div role="radiogroup" aria-label="Filtrar vencimientos" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`h-8 shrink-0 rounded-full px-3 text-[12.5px] transition-colors sm:h-9 sm:px-3.5 ${
                  filter === f.value ? "bg-dark font-bold text-dark-fg" : "border border-border bg-surface font-medium text-text-muted hover:text-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cifras del mes: una sola barra que se reparte entre cobrado, a cobrar y vencido */}
      <section aria-label="Resumen del mes" className="rounded-[20px] border border-border bg-surface p-4 md:p-5">
        <div className="flex h-2 w-full sm:h-3 overflow-hidden rounded-full bg-bg" aria-hidden>
          <motion.span className="h-full bg-olive-light" initial={false} animate={{ width: `${(s.collected / total) * 100}%` }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
          <motion.span className="h-full bg-accent" initial={false} animate={{ width: `${(s.pending / total) * 100}%` }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
          <motion.span className="h-full bg-terra" initial={false} animate={{ width: `${(s.overdue / total) * 100}%` }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
        </div>
        {/* Mobile: una línea deslizable con las tres cifras que mandan */}
        <dl className="mt-3 grid grid-cols-3 gap-3 sm:hidden">
          {[
            { l: "Cobrado", v: s.collected, dot: "bg-olive-light", tone: "text-text" },
            { l: "A cobrar", v: s.pending, dot: "bg-accent", tone: "text-text" },
            { l: "Vencido", v: s.overdue, dot: "bg-terra", tone: s.overdue > 0 ? "text-terra" : "text-text" },
          ].map((f) => (
            <div key={f.l} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-muted">
                {f.dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />}
                {f.l}
              </dt>
              <dd className={`font-display text-[15px] font-bold tabular-nums ${f.tone}`}>{money(f.v)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[12px] text-text-faint sm:hidden">
          Honorarios <span className="font-semibold tabular-nums text-text-muted">{money(s.fees)}</span> · a rendir{" "}
          <span className="font-semibold tabular-nums text-text-muted">{money(s.toOwners)}</span>
        </p>
        <dl className="mt-4 hidden grid-cols-3 gap-x-4 gap-y-3 sm:grid lg:grid-cols-5">
          <Figure label="Cobrado" value={money(s.collected)} dot="bg-olive-light" sub={`${s.counts.pagado} de ${data.dues.length} vencimientos`} />
          <Figure label="A cobrar" value={money(s.pending)} dot="bg-accent" sub={`${s.counts.esperando + (s.counts.parcial || 0)} pendientes`} />
          <Figure
            label="Vencido"
            value={money(s.overdue)}
            dot="bg-terra"
            sub={s.counts.vencido ? `${s.counts.vencido} ${s.counts.vencido === 1 ? "vencimiento atrasado" : "vencimientos atrasados"} este mes` : "Nada atrasado este mes"}
            tone={s.overdue > 0 ? "text-terra" : undefined}
          />
          <Figure label="Honorarios" value={money(s.fees)} sub="Queda para la inmobiliaria" />
          <Figure label="A rendir" value={money(s.toOwners)} sub="Neto a propietarios" />
        </dl>
        {data.overdueElsewhere > 0 && (
          <Link href="/alquileres/contratos?filtro=con_deuda" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-terra hover:underline">
            <IconAlert size={14} />
            {data.overdueElsewhere} {data.overdueElsewhere === 1 ? "cuota atrasada" : "cuotas atrasadas"} de meses anteriores
          </Link>
        )}
      </section>

      {data.dues.length === 0 && data.adjustments.length === 0 && data.endings.length === 0 ? (
        <Empty title={q ? "Nada coincide con la búsqueda" : "Sin vencimientos este mes"} icon={<IconCalendar size={20} />}>
          {q ? (
            <button type="button" className={btnText} onClick={() => { setSearch(""); navigate({ q: null }); }}>
              Limpiar búsqueda
            </button>
          ) : (
            <>
              Cuando cargues un contrato, sus vencimientos aparecen acá día por día.{" "}
              <Link href="/alquileres/contratos/nuevo" className="font-semibold text-terra hover:underline">
                Cargar contrato
              </Link>
            </>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <MonthGrid month={data.month} today={data.today} selected={selected} onSelect={setSelected} byDay={byDay} />
          <DayStrip month={data.month} today={data.today} selected={selected} onSelect={setSelected} byDay={byDay} />
          <DayPanel
            day={selected}
            today={data.today}
            entry={byDay.get(selected)}
            onCollect={setCollectDue}
            onAdjust={(a) => setAdjustTarget(toTarget(a))}
            nextDays={[...byDay.keys()].filter((k) => k > selected).sort().slice(0, 3)}
            onSelect={setSelected}
          />
          <RestOfMonth byDay={byDay} after={selected} onSelect={setSelected} />
        </div>
      )}

      <CollectSheet dueId={collectDue} open={Boolean(collectDue)} onClose={() => setCollectDue(null)} onDone={refresh} />
      <AdjustmentSheet target={adjustTarget} onClose={() => setAdjustTarget(null)} onDone={refresh} />
      <Sheet
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title="Hay alquileres para aumentar"
        description="Llegó la fecha de ajuste de estos contratos."
        maxWidth="sm:max-w-lg"
        footer={
          <>
            <span />
            <button type="button" className={btnPrimarySm + " h-10"} onClick={() => setReminderOpen(false)}>
              Entendido
            </button>
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {data.adjustmentsToApply.map((a) => (
            <li key={a.contractId} className="flex items-center justify-between gap-3 rounded-[16px] bg-bg px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold text-text">{propertyLine(a.property.address, a.unit)}</p>
                <p className="truncate text-[12px] text-text-faint">
                  {a.tenantName} · {a.index ?? "sin índice"} · {a.alert === "overdue" ? "desde el" : "el"} {dateAR(a.date)}
                </p>
              </div>
              <button
                type="button"
                className={btnGold}
                onClick={() => {
                  setReminderOpen(false);
                  setAdjustTarget(toTarget(a));
                }}
              >
                Aplicar
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

function Figure({ label, value, sub, dot, tone, className = "" }: { label: string; value: string; sub?: string; dot?: string; tone?: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted">
        {dot && <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </dt>
      <dd className={`mt-0.5 truncate font-display text-[20px] font-bold tabular-nums leading-tight md:text-[22px] ${tone ?? "text-text"}`}>{value}</dd>
      {sub && <dd className="truncate text-[11.5px] text-text-faint">{sub}</dd>}
    </div>
  );
}

function AdjustmentStrip({ items, onApply }: { items: AgendaAdjustment[]; onApply: (a: AgendaAdjustment) => void }) {
  return (
    <section aria-label="Aumentos para aplicar" className="flex flex-col gap-2 rounded-[20px] bg-dark p-4 text-dark-fg md:flex-row md:items-center md:gap-4">
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-accent">
          <IconFlag size={17} />
        </span>
        <p className="font-display text-[15px] font-semibold">
          {items.length === 1 ? "1 alquiler para aumentar" : `${items.length} alquileres para aumentar`}
        </p>
      </div>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-1 md:px-0">
        {items.map((a) => (
          <li key={a.contractId} className="flex shrink-0 items-center gap-3 rounded-full bg-white/[0.07] py-1.5 pl-3.5 pr-1.5">
            <span className="text-[12.5px]">
              <span className="font-bold">{a.property.address}</span>
              <span className="text-dark-muted"> · {a.index ?? "ajuste"} · {dateAR(a.date).slice(0, 5)}</span>
            </span>
            <button type="button" onClick={() => onApply(a)} className="h-8 rounded-full bg-accent px-3 text-[12px] font-bold text-dark hover:opacity-90">
              Aplicar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type DayEntry = { dues: AgendaDue[]; adjustments: AgendaAdjustment[]; endings: AgendaEnding[] };

function monthDays(month: string) {
  const first = DateTime.fromISO(`${month}-01`, { zone: "utc" });
  const days: string[] = [];
  for (let d = first; d.month === first.month; d = d.plus({ days: 1 })) days.push(d.toISODate()!);
  return { first, days };
}

function MonthGrid({
  month,
  today,
  selected,
  onSelect,
  byDay,
}: {
  month: string;
  today: string;
  selected: string;
  onSelect: (d: string) => void;
  byDay: Map<string, DayEntry>;
}) {
  const { first, days } = monthDays(month);
  const lead = first.weekday - 1; // lunes = 1
  const cells: Array<string | null> = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  return (
    <section aria-label={`Calendario de ${monthLabel(month)}`} className="hidden self-start overflow-hidden rounded-[20px] border border-border bg-surface md:block">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">
            {w}
          </div>
        ))}
      </div>
      <div role="grid" className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className={`min-h-[132px] bg-bg/60 ${i % 7 ? "border-l border-border" : ""} ${i >= 7 ? "border-t border-border" : ""}`} />;
          const entry = byDay.get(day);
          const isToday = day === today;
          const isSelected = day === selected;
          const adjustments = entry?.adjustments ?? [];
          const visible = entry?.dues.slice(0, Math.max(1, 3 - adjustments.length)) ?? [];
          const extra = (entry?.dues.length ?? 0) - visible.length;
          const weekend = i % 7 >= 5;
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${dayLong(day)}${entry?.dues.length ? `, ${entry.dues.length} vencimientos` : ""}${entry?.adjustments.length ? `, ${entry.adjustments.length} aumentos` : ""}`}
              onClick={() => onSelect(day)}
              className={`group relative flex min-h-[132px] flex-col gap-1 p-2 text-left transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                i % 7 ? "border-l border-border" : ""
              } ${i >= 7 ? "border-t border-border" : ""} ${isSelected ? "bg-sand-chip/60" : weekend ? "bg-bg/40 hover:bg-bg" : "hover:bg-bg"}`}
            >
              <span className="flex items-center justify-between">
                <span
                  className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 font-display text-[16px] font-semibold tabular-nums ${
                    isSelected ? "bg-dark text-dark-fg" : isToday ? "text-accent ring-1 ring-accent" : "text-text-muted"
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
                {entry?.dues.length ? (
                  <span className="text-[10.5px] font-semibold tabular-nums text-text-faint">{entry.dues.length}</span>
                ) : null}
              </span>
              {adjustments.map((a) => (
                <span key={a.contractId} className="flex min-w-0 items-center gap-1 rounded-md bg-accent px-1.5 py-1 text-[11px] font-bold text-dark">
                  <IconFlag size={11} className="shrink-0" />
                  <span className="truncate">{a.property.address}</span>
                </span>
              ))}
              {visible.map((d) => (
                <span key={d.dueId} className={`flex min-w-0 flex-col rounded-md px-1.5 py-1 leading-tight ${DUE_BAR[d.status]}`}>
                  <span className="truncate text-[11px] font-semibold">{d.property.address}</span>
                  <span className="text-[10.5px] tabular-nums opacity-80">{moneyShort(d.expected, d.currency)}</span>
                </span>
              ))}
              {extra > 0 && <span className="px-1.5 text-[11px] font-semibold text-text-faint">+{extra} más</span>}
              {entry?.endings.map((e) => (
                <span key={e.contractId} className="truncate rounded-md border border-dashed border-border-strong px-1.5 py-[2px] text-[10.5px] font-semibold text-text-faint">
                  Termina · {e.property.address}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Mobile: tira de días deslizable con puntos de estado. */
function DayStrip({
  month,
  today,
  selected,
  onSelect,
  byDay,
}: {
  month: string;
  today: string;
  selected: string;
  onSelect: (d: string) => void;
  byDay: Map<string, DayEntry>;
}) {
  const { days } = monthDays(month);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <div ref={ref} role="tablist" aria-label="Días del mes" className="-mx-5 flex snap-x gap-1.5 overflow-x-auto px-5 pb-1 md:hidden">
      {days.map((day) => {
        const entry = byDay.get(day);
        const dt = DateTime.fromISO(day, { zone: "utc" }).setLocale("es");
        const isSel = day === selected;
        const statuses = [...new Set(entry?.dues.map((d) => d.status) ?? [])].slice(0, 3);
        return (
          <button
            key={day}
            data-day={day}
            type="button"
            role="tab"
            aria-selected={isSel}
            aria-label={dayLong(day)}
            onClick={() => onSelect(day)}
            className={`flex w-12 shrink-0 snap-center flex-col items-center gap-1 rounded-[16px] py-2 transition-colors ${
              isSel ? "bg-dark text-dark-fg" : day === today ? "bg-surface text-text ring-1 ring-accent" : "bg-surface text-text-muted"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase ${isSel ? "text-dark-muted" : "text-text-faint"}`}>{dt.toFormat("ccc").slice(0, 2)}</span>
            <span className="font-display text-[16px] font-semibold tabular-nums">{dt.day}</span>
            <span className="flex h-1.5 items-center gap-0.5">
              {statuses.map((st) => (
                <span key={st} className={`h-1.5 w-1.5 rounded-full ${DUE_DOT[st]}`} />
              ))}
              {entry?.adjustments.length ? <span className="h-1.5 w-1.5 rounded-full bg-accent ring-1 ring-dark/20" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DayPanel({
  day,
  today,
  entry,
  onCollect,
  onAdjust,
  nextDays,
  onSelect,
}: {
  day: string;
  today: string;
  entry: DayEntry | undefined;
  onCollect: (dueId: string) => void;
  onAdjust: (a: AgendaAdjustment) => void;
  nextDays: string[];
  onSelect: (d: string) => void;
}) {
  const dues = entry?.dues ?? [];
  const totalDay = dues.reduce((acc, d) => acc + d.expected, 0);
  const empty = !dues.length && !entry?.adjustments.length && !entry?.endings.length;
  return (
    <section aria-label={`Vencimientos del ${dayLong(day)}`} className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="font-display text-[18px] font-semibold text-text">
          {day === today ? "Hoy, " : ""}
          {day === today ? dayLong(day) : capitalize(dayLong(day))}
        </h3>
        {dues.length > 0 && <span className="shrink-0 font-display text-[14px] font-bold tabular-nums text-text-muted">{money(totalDay)}</span>}
      </div>

      {entry?.adjustments.map((a) => (
        <article key={a.contractId} className="flex items-center gap-3 rounded-[18px] bg-dark p-3.5 text-dark-fg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
            <IconTrend size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold">{propertyLine(a.property.address, a.unit)}</p>
            <p className="truncate text-[12px] text-dark-muted">
              Aumenta por {a.index ?? "acuerdo"} · hoy {money(a.currentAmount, a.currency)}
            </p>
          </div>
          <button type="button" onClick={() => onAdjust(a)} className={btnGold}>
            Aplicar
          </button>
        </article>
      ))}

      {dues.map((d) => (
        <DueCard key={d.dueId} due={d} onCollect={() => onCollect(d.dueId)} />
      ))}

      {entry?.endings.map((e) => (
        <article key={e.contractId} className="flex items-center justify-between gap-3 rounded-[18px] border border-dashed border-border-strong px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-bold text-text">{propertyLine(e.property.address, e.unit)}</p>
            <p className="text-[12px] text-text-faint">Termina el contrato de {e.tenantName}</p>
          </div>
          <Link href={`/alquileres/${e.contractId}`} className="shrink-0 font-display text-[12.5px] font-bold text-terra hover:underline">
            Ver legajo
          </Link>
        </article>
      ))}

      {empty && (
        <div className="rounded-[20px] bg-bg px-5 py-6 text-center">
          <p className="font-display text-[15px] font-semibold text-text">Nada vence este día</p>
          {nextDays.length > 0 ? (
            <p className="mt-1 text-[12.5px] text-text-faint">
              Próximo:{" "}
              {nextDays.map((d, i) => (
                <span key={d}>
                  {i > 0 && ", "}
                  <button type="button" onClick={() => onSelect(d)} className="font-semibold text-terra hover:underline">
                    {dayLong(d)}
                  </button>
                </span>
              ))}
            </p>
          ) : (
            <p className="mt-1 text-[12.5px] text-text-faint">No quedan vencimientos en lo que resta del mes.</p>
          )}
        </div>
      )}
    </section>
  );
}

function DueCard({ due, onCollect }: { due: AgendaDue; onCollect: () => void }) {
  const remaining = Math.max(0, due.expected - due.collected);
  const missing = due.servicesRequired.filter((s) => !due.servicesUploaded.includes(s));
  const canCollect = due.status !== "pagado" && due.status !== "condonado";
  return (
    <article className="rounded-[18px] border border-border bg-surface p-3.5 transition-shadow hover:shadow-[0_6px_20px_-12px_rgba(27,25,22,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/alquileres/${due.contractId}`} className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-accent">
          <p className="truncate text-[13.5px] font-bold text-text">{propertyLine(due.property.address, due.unit)}</p>
          <p className="truncate text-[12px] text-text-faint">
            {due.tenant.fullName}
            {due.ownerName ? ` · prop. ${due.ownerName}` : ""}
          </p>
        </Link>
        <DuePill status={due.status} />
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[19px] font-bold tabular-nums leading-tight text-text">{money(canCollect ? remaining : due.collected, due.currency)}</p>
          <p className="text-[11.5px] text-text-faint">
            {due.status === "parcial" ? `Cobrado ${money(due.collected, due.currency)} de ${money(due.expected, due.currency)}` : `Cuota ${due.position} · honorarios ${due.feePercent}%`}
          </p>
        </div>
        {canCollect ? (
          <button type="button" onClick={onCollect} className={btnPrimarySm}>
            <IconReceipt size={14} className="text-accent" />
            Cobrar
          </button>
        ) : (
          <Link href={`/alquileres/${due.contractId}#cuota-${due.dueId}`} className={btnSecondarySm}>
            Ver recibos
          </Link>
        )}
      </div>
      {(due.servicesRequired.length > 0 || due.pendingProofs > 0) && (
        <p className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5 text-[11.5px]">
          {due.pendingProofs > 0 && (
            <Link href="/alquileres/comprobantes" className="rounded-full bg-sand-chip px-2 py-0.5 font-bold text-warning hover:underline">
              {due.pendingProofs} comprobante{due.pendingProofs > 1 ? "s" : ""} para revisar
            </Link>
          )}
          {missing.length > 0 ? (
            <span className="text-text-faint">Faltan comprobantes: {missing.join(", ")}</span>
          ) : due.servicesRequired.length > 0 ? (
            <span className="text-olive-light">Servicios al día</span>
          ) : null}
        </p>
      )}
    </article>
  );
}

/** Mobile: lo que viene en el resto del mes, para no depender del día elegido. */
function RestOfMonth({ byDay, after, onSelect }: { byDay: Map<string, DayEntry>; after: string; onSelect: (d: string) => void }) {
  const days = [...byDay.entries()].filter(([d, e]) => d > after && (e.dues.length || e.adjustments.length)).sort(([a], [b]) => a.localeCompare(b));
  if (!days.length) return null;
  return (
    <section aria-label="Resto del mes" className="md:hidden">
      <h3 className="mb-2 px-1 font-display text-[15px] font-semibold text-text">Lo que viene este mes</h3>
      <ul className="flex flex-col divide-y divide-border rounded-[18px] border border-border bg-surface">
        {days.map(([d, e]) => {
          const total = e.dues.reduce((a, x) => a + Math.max(0, x.expected - x.collected), 0);
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => {
                  onSelect(d);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-bg"
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-text">{capitalize(dayLong(d))}</span>
                  <span className="block truncate text-[12px] text-text-faint">
                    {e.dues.map((x) => x.property.address).join(", ")}
                    {e.adjustments.length ? `${e.dues.length ? " · " : ""}aumenta ${e.adjustments.map((a) => a.property.address).join(", ")}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {e.adjustments.length > 0 && <IconFlag size={13} className="text-accent" />}
                  {total > 0 && <span className="font-display text-[13.5px] font-bold tabular-nums text-text">{money(total)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
