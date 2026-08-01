"use client";

import { useState, useMemo, useEffect } from "react";
import { DateTime, Info } from "luxon";
import type { NoteAttachment } from "@/components/notes/media-uploader";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date "2026-02-26"
  startTime: string; // "14:00"
  endTime: string; // "15:00"
  type: "visita" | "firma" | "tasacion" | "otro" | "firma_informes" | "firma_acordada" | "entrega_llaves";
  description?: string;
  client?: string;
  clientId?: string;
  property?: string;
  propertyId?: string;
  attachments?: NoteAttachment[] | null;
  userName?: string;
  /** "google" = evento traído de Google Calendar (solo lectura). */
  source?: "internal" | "google";
  htmlLink?: string;
  allDay?: boolean;
}

interface CalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Color map per event type                                           */
/* ------------------------------------------------------------------ */

const typeColors: Record<CalendarEvent["type"], { bg: string; text: string; dot: string }> = {
  visita: { bg: "bg-sage-chip", text: "text-olive-light", dot: "bg-olive-light" },
  firma: { bg: "bg-sand-chip", text: "text-warning", dot: "bg-warning" },
  tasacion: { bg: "bg-info-chip", text: "text-info", dot: "bg-info" },
  otro: { bg: "bg-sand-chip", text: "text-warning", dot: "bg-warning" },
  firma_informes: { bg: "bg-info-chip", text: "text-info", dot: "bg-info" },
  firma_acordada: { bg: "bg-sand-chip", text: "text-warning", dot: "bg-warning" },
  entrega_llaves: { bg: "bg-sage-chip", text: "text-olive-light", dot: "bg-olive-light" },
};

const typeLabels: Record<string, string> = {
  visita: "Visita",
  firma: "Firma",
  tasacion: "Tasación",
  otro: "Otro",
  firma_informes: "Inicio trámite",
  firma_acordada: "Firma acordada",
  entrega_llaves: "Entrega llaves",
};

/** Estilo distintivo para eventos externos de Google Calendar. */
const googleStyle = { bg: "bg-info-chip", text: "text-info", dot: "bg-info" };

function eventStyle(ev: CalendarEvent): { bg: string; text: string; dot: string } {
  return ev.source === "google" ? googleStyle : typeColors[ev.type];
}

/**
 * Control del overlay de Google Calendar. Compartido por los headers de mobile
 * y desktop para que ambos ofrezcan el mismo control en el mismo lugar.
 * Cuando el usuario no tiene Google conectado muestra un enlace para conectarlo,
 * de modo que "sin conectar" no se confunda con "sin reuniones".
 */
function GoogleToggle({
  connected,
  showGoogle,
  onToggle,
  compact = false,
}: {
  connected: boolean | null;
  showGoogle: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const size = compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  if (connected === false) {
    return (
      <a
        href="/login"
        title="Iniciá sesión con Google para ver tus reuniones en la agenda"
        className={`flex items-center gap-1.5 rounded-full border border-border bg-surface font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text ${size}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-text-faint" />
        Conectar Google
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      title={showGoogle ? "Ocultar Google Calendar" : "Mostrar Google Calendar"}
      className="flex items-center gap-2"
    >
      <span className={`${compact ? "text-[11px]" : "text-xs"} font-semibold ${showGoogle ? "text-text" : "text-text-faint"}`}>
        Google
      </span>
      <span
        className={`relative inline-flex ${compact ? "h-5 w-9" : "h-6 w-11"} flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
          showGoogle ? "bg-olive-light" : "bg-border"
        }`}
      >
        <span
          className={`absolute left-0.5 ${compact ? "h-4 w-4" : "h-5 w-5"} rounded-full bg-white shadow-sm transition-transform duration-200 ${
            showGoogle ? (compact ? "translate-x-4" : "translate-x-5") : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Calendar({ events, onEventClick }: CalendarProps) {
  const [current, setCurrent] = useState(() => DateTime.now().startOf("month"));
  const [selectedDate, setSelectedDate] = useState(() => DateTime.now());
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [showGoogle, setShowGoogle] = useState(true);
  /** null = aún no sabemos; false = usuario sin Google Calendar conectado. */
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  /** Día cuyo detalle se expande en desktop (al tocar "+N más"). */
  const [dayPopover, setDayPopover] = useState<string | null>(null);

  const weekdays = Info.weekdays("short", { locale: "es" });
  const weekdaysNarrow = Info.weekdays("narrow", { locale: "es" });

  /* Overlay solo lectura de Google Calendar (reuniones del email logueado) */
  useEffect(() => {
    if (!showGoogle) return;
    let active = true;
    const from = current.startOf("month").minus({ days: 7 }).toISODate();
    const to = current.endOf("month").plus({ days: 7 }).toISODate();
    (async () => {
      try {
        const res = await fetch(`/api/agenda/google-events?from=${from}&to=${to}`);
        const body = await res.json();
        if (!active) return;
        const payload = body?.data;
        setGoogleEvents(Array.isArray(payload?.events) ? (payload.events as CalendarEvent[]) : []);
        setGoogleConnected(payload?.connected ?? null);
      } catch {
        if (active) setGoogleEvents([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [current, showGoogle]);

  const allEvents = useMemo(
    () => (showGoogle ? [...events, ...googleEvents] : events),
    [events, googleEvents, showGoogle]
  );

  /* Click: eventos de Google abren Google Calendar; el resto, el modal interno */
  function handleEventClick(ev: CalendarEvent) {
    if (ev.source === "google") {
      if (ev.htmlLink) window.open(ev.htmlLink, "_blank", "noopener,noreferrer");
      return;
    }
    onEventClick?.(ev);
  }

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
    for (const ev of allEvents) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    // Orden cronológico dentro del día: si no se ordena, los internos van
    // siempre primero y los de Google caen fuera del corte de 3 visibles.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.startTime.localeCompare(b.startTime);
      });
    }
    return map;
  }, [allEvents]);

  const today = DateTime.now().toISODate();
  const selectedIso = selectedDate.toISODate()!;
  const selectedDayEvents = eventsByDate.get(selectedIso) ?? [];

  /* Unique dot colors for a given day (max 3 dots) -------------------- */
  function dayEventDots(iso: string): string[] {
    const evts = eventsByDate.get(iso);
    if (!evts) return [];
    const unique = [...new Set(evts.map((e) => eventStyle(e).dot))];
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
            <h2 className="font-display text-lg font-semibold capitalize text-text">
              {current.toFormat("MMMM yyyy", { locale: "es" })}
            </h2>
            <button
              onClick={goToday}
              className="rounded-full bg-sand-chip px-2.5 py-0.5 text-[11px] font-bold text-warning transition-opacity hover:opacity-80"
            >
              Hoy
            </button>
            <GoogleToggle
              connected={googleConnected}
              showGoogle={showGoogle}
              onToggle={() => setShowGoogle((v) => !v)}
              compact
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-bg hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-bg hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compact month grid */}
        <div className="mb-4 overflow-hidden rounded-[20px] border border-border bg-surface">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekdaysNarrow.map((d, i) => (
              <div
                key={i}
                className="py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint"
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
              const dots = dayEventDots(iso);

              return (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                    !isCurrentMonth ? "opacity-25" : ""
                  } ${isSelected ? "bg-sand-chip/60" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-dark font-bold text-accent"
                        : isSelected
                          ? "bg-surface font-semibold text-text shadow-sm"
                          : "text-text/70"
                    }`}
                  >
                    {day.day}
                  </span>
                  {/* Event dots by color */}
                  <div className="flex h-1.5 items-center gap-px">
                    {dots.map((dot) => (
                      <span key={dot} className={`h-1 w-1 rounded-full ${dot}`} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day summary */}
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-sm font-semibold capitalize text-text">
            {selectedDate.toFormat("cccc d 'de' MMMM", { locale: "es" })}
          </p>
          <span className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-bold text-text-faint">
            {selectedDayEvents.length} evento{selectedDayEvents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Day agenda cards */}
        <div className="flex flex-col gap-2">
          {selectedDayEvents.length === 0 ? (
            <div className="rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
              Sin eventos para este día
            </div>
          ) : (
            selectedDayEvents.map((ev) => {
              const colors = eventStyle(ev);
              const isGoogle = ev.source === "google";
              return (
                <button
                  key={ev.id}
                  onClick={() => handleEventClick(ev)}
                  className="flex items-start gap-3 rounded-[16px] border border-border bg-surface p-4 text-left transition-colors active:bg-bg hover:bg-bg"
                >
                  {/* Color bar */}
                  <div className={`mt-0.5 h-10 w-1 flex-shrink-0 rounded-full ${colors.dot}`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13.5px] font-bold text-text">{ev.title}</p>
                      <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                        {isGoogle ? "Google" : typeLabels[ev.type]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {ev.allDay ? "Todo el día" : `${ev.startTime} – ${ev.endTime}`}
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
                        {ev.userName && (
                          <span className="text-xs text-text-muted">
                            <span className="text-text-muted/50">Resp:</span> {ev.userName}
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
            <h2 className="font-display text-xl font-semibold capitalize text-text">
              {current.toFormat("MMMM yyyy", { locale: "es" })}
            </h2>
            <button
              onClick={goToday}
              className="rounded-full bg-sand-chip px-3 py-1 text-xs font-bold text-warning transition-opacity hover:opacity-80"
            >
              Hoy
            </button>
            <GoogleToggle
              connected={googleConnected}
              showGoogle={showGoogle}
              onToggle={() => setShowGoogle((v) => !v)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-bg hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-bg hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekdays.map((d) => (
              <div
                key={d}
                className="px-3 py-2.5 text-center text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint"
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
                  className={`relative min-h-[120px] border-b border-r border-border p-2 transition-colors last:border-r-0 ${
                    isCurrentMonth ? "" : "opacity-30"
                  } ${isToday ? "bg-sand-chip" : "hover:bg-bg"}`}
                  style={{
                    borderRight: (i + 1) % 7 === 0 ? "none" : undefined,
                  }}
                >
                  {/* Day number */}
                  <div className="mb-1.5 flex items-center justify-end">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                        isToday
                          ? "bg-dark font-display font-bold text-accent"
                          : "font-medium text-text"
                      }`}
                    >
                      {day.day}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="flex flex-col gap-1">
                    {dayEvents.slice(0, maxVisible).map((ev) => {
                      const colors = eventStyle(ev);
                      const timeLabel = ev.allDay ? "Todo el día" : `${ev.startTime}-${ev.endTime}`;
                      return (
                        <div
                          key={ev.id}
                          onClick={() => handleEventClick(ev)}
                          className="group flex cursor-pointer items-center gap-1.5 rounded-lg bg-bg px-1.5 py-1 transition-colors hover:bg-border/40"
                          title={`${timeLabel} · ${ev.title}${ev.source === "google" ? " · Google" : ""}${ev.client ? ` · ${ev.client}` : ""}${ev.userName ? ` · ${ev.userName}` : ""}`}
                        >
                          <span className={`h-3.5 w-1 flex-shrink-0 rounded-full ${colors.dot}`} />
                          <span className="truncate text-[11px] font-semibold text-text">
                            {ev.title}
                          </span>
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <button
                        type="button"
                        onClick={() => setDayPopover(iso)}
                        className="w-fit rounded-full bg-bg px-2 py-0.5 text-left text-[10px] font-bold text-text-muted transition-colors hover:text-text"
                      >
                        +{overflow} más
                      </button>
                    )}
                  </div>

                  {/* Detalle completo del día (al tocar "+N más") */}
                  {dayPopover === iso && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setDayPopover(null)}
                      />
                      <div className="absolute z-50 mt-1 w-64 rounded-2xl border border-border bg-surface p-3 shadow-2xl">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-display text-xs font-semibold capitalize text-text">
                            {day.toFormat("cccc d 'de' MMMM", { locale: "es" })}
                          </p>
                          <button
                            type="button"
                            onClick={() => setDayPopover(null)}
                            className="text-text-muted transition-colors hover:text-text"
                            aria-label="Cerrar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                          {dayEvents.map((ev) => {
                            const colors = eventStyle(ev);
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => {
                                  setDayPopover(null);
                                  handleEventClick(ev);
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-bg px-1.5 py-1 text-left transition-colors hover:bg-border/40"
                              >
                                <span className={`h-3.5 w-1 flex-shrink-0 rounded-full ${colors.dot}`} />
                                <span className="flex-shrink-0 text-[10px] text-text-faint">
                                  {ev.allDay ? "Todo el día" : ev.startTime}
                                </span>
                                <span className="truncate text-[11px] font-semibold text-text">
                                  {ev.title}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {Object.entries(typeColors).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <span className="text-xs capitalize text-text-muted">{typeLabels[type] ?? type}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${googleStyle.dot}`} />
            <span className="text-xs text-text-muted">Google Calendar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
