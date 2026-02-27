"use client";

import { useState, useMemo } from "react";
import { DateTime, Info } from "luxon";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date "2026-02-26"
  startTime: string; // "14:00"
  endTime: string; // "15:00"
  type: "visita" | "firma" | "tasacion" | "otro";
  description?: string;
  client?: string;
  clientId?: string;
  property?: string;
  propertyId?: string;
}

interface CalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Color map per event type                                           */
/* ------------------------------------------------------------------ */

const typeColors: Record<CalendarEvent["type"], { bg: string; text: string; dot: string }> = {
  visita: { bg: "bg-secondary/15", text: "text-secondary", dot: "bg-secondary" },
  firma: { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  tasacion: { bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" },
  otro: { bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400" },
};

const typeLabels: Record<string, string> = {
  visita: "Visita",
  firma: "Firma",
  tasacion: "Tasación",
  otro: "Otro",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Calendar({ events, onEventClick }: CalendarProps) {
  const [current, setCurrent] = useState(() => DateTime.now().startOf("month"));
  const [selectedDate, setSelectedDate] = useState(() => DateTime.now());

  const weekdays = Info.weekdays("short", { locale: "es" });
  const weekdaysNarrow = Info.weekdays("narrow", { locale: "es" });

  /* Build the 6-row grid ---------------------------------------------- */
  const grid = useMemo(() => {
    const firstDay = current.startOf("month");
    const startOffset = firstDay.weekday - 1;
    const gridStart = firstDay.minus({ days: startOffset });

    const cells: DateTime[] = [];
    for (let i = 0; i < 42; i++) {
      cells.push(gridStart.plus({ days: i }));
    }
    return cells;
  }, [current]);

  /* Index events by date string --------------------------------------- */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const today = DateTime.now().toISODate();
  const selectedIso = selectedDate.toISODate()!;
  const selectedDayEvents = eventsByDate.get(selectedIso) ?? [];

  /* Unique event types for a given day (max 3 dots) ------------------- */
  function dayEventTypes(iso: string): CalendarEvent["type"][] {
    const evts = eventsByDate.get(iso);
    if (!evts) return [];
    const unique = [...new Set(evts.map((e) => e.type))];
    return unique.slice(0, 3);
  }

  /* Nav --------------------------------------------------------------- */
  function prevMonth() {
    setCurrent((c) => c.minus({ months: 1 }));
  }
  function nextMonth() {
    setCurrent((c) => c.plus({ months: 1 }));
  }
  function goToday() {
    setCurrent(DateTime.now().startOf("month"));
    setSelectedDate(DateTime.now());
  }
  function selectDay(day: DateTime) {
    setSelectedDate(day);
    // If tapping a day from another month, also navigate
    if (day.month !== current.month || day.year !== current.year) {
      setCurrent(day.startOf("month"));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ============================================================== */}
      {/*  MOBILE: Compact month + Day agenda (<640px)                   */}
      {/* ============================================================== */}
      <div className="sm:hidden">
        {/* Mobile header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium capitalize text-text">
              {current.toFormat("MMMM yyyy", { locale: "es" })}
            </h2>
            <button
              onClick={goToday}
              className="rounded-lg border border-border px-2.5 py-0.5 text-[11px] text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              Hoy
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compact month grid */}
        <div className="mb-4 overflow-hidden rounded-xl border border-border bg-surface/30">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekdaysNarrow.map((d, i) => (
              <div
                key={i}
                className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const iso = day.toISODate()!;
              const isCurrentMonth = day.month === current.month;
              const isToday = iso === today;
              const isSelected = iso === selectedIso;
              const dots = dayEventTypes(iso);

              return (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                    !isCurrentMonth ? "opacity-25" : ""
                  } ${isSelected ? "bg-secondary/15" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                      isToday && isSelected
                        ? "bg-secondary font-bold text-bg"
                        : isToday
                          ? "bg-secondary/30 font-semibold text-secondary"
                          : isSelected
                            ? "font-semibold text-text"
                            : "text-text/70"
                    }`}
                  >
                    {day.day}
                  </span>
                  {/* Event dots by type */}
                  <div className="flex h-1.5 items-center gap-px">
                    {dots.map((type) => (
                      <span key={type} className={`h-1 w-1 rounded-full ${typeColors[type].dot}`} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day summary */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium capitalize text-text">
            {selectedDate.toFormat("cccc d 'de' MMMM", { locale: "es" })}
          </p>
          <span className="text-xs text-text-muted">
            {selectedDayEvents.length} evento{selectedDayEvents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Day agenda cards */}
        <div className="flex flex-col gap-2">
          {selectedDayEvents.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-surface/20 px-4 py-8 text-center text-sm text-text-muted">
              Sin eventos para este día
            </div>
          ) : (
            selectedDayEvents.map((ev) => {
              const colors = typeColors[ev.type];
              return (
                <button
                  key={ev.id}
                  onClick={() => onEventClick?.(ev)}
                  className="flex items-start gap-3 rounded-xl border border-border/50 p-4 text-left transition-colors hover:bg-surface/50"
                >
                  {/* Color bar */}
                  <div className={`mt-0.5 h-10 w-1 flex-shrink-0 rounded-full ${colors.dot}`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-text">{ev.title}</p>
                      <span className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                        {typeLabels[ev.type]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {ev.startTime} – {ev.endTime}
                    </p>
                    {(ev.client || ev.property) && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {ev.client && (
                          <span className="text-xs text-text-muted">
                            <span className="text-text-muted/50">Cliente:</span> {ev.client}
                          </span>
                        )}
                        {ev.property && (
                          <span className="truncate text-xs text-text-muted">
                            <span className="text-text-muted/50">Propiedad:</span> {ev.property}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/*  DESKTOP: Month grid (>=640px)                                 */}
      {/* ============================================================== */}
      <div className="hidden sm:block">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-medium capitalize text-text">
              {current.toFormat("MMMM yyyy", { locale: "es" })}
            </h2>
            <button
              onClick={goToday}
              className="rounded-lg border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              Hoy
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface/30">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekdays.map((d) => (
              <div
                key={d}
                className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-widest text-text-muted"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const iso = day.toISODate()!;
              const isCurrentMonth = day.month === current.month;
              const isToday = iso === today;
              const dayEvents = eventsByDate.get(iso) ?? [];
              const maxVisible = 3;
              const overflow = dayEvents.length - maxVisible;

              return (
                <div
                  key={i}
                  className={`min-h-[120px] border-b border-r border-border/50 p-2 transition-colors last:border-r-0 ${
                    isCurrentMonth ? "" : "opacity-30"
                  } ${isToday ? "bg-secondary/5" : "hover:bg-surface/30"}`}
                  style={{
                    borderRight: (i + 1) % 7 === 0 ? "none" : undefined,
                  }}
                >
                  {/* Day number */}
                  <div className="mb-1.5 flex items-center justify-end">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                        isToday
                          ? "bg-secondary font-semibold text-bg"
                          : "font-medium text-text"
                      }`}
                    >
                      {day.day}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="flex flex-col gap-1">
                    {dayEvents.slice(0, maxVisible).map((ev) => {
                      const colors = typeColors[ev.type];
                      return (
                        <div
                          key={ev.id}
                          onClick={() => onEventClick?.(ev)}
                          className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors ${colors.bg} hover:brightness-125`}
                          title={`${ev.startTime}-${ev.endTime} · ${ev.title}${ev.client ? ` · ${ev.client}` : ""}`}
                        >
                          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${colors.dot}`} />
                          <span className={`truncate text-[11px] font-medium ${colors.text}`}>
                            {ev.title}
                          </span>
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <span className="pl-1 text-[10px] text-text-muted">
                        +{overflow} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-5 flex items-center gap-5">
          {Object.entries(typeColors).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <span className="text-xs capitalize text-text-muted">{typeLabels[type] ?? type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
