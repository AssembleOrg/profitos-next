/**
 * Política de horarios del scraper (auto-throttle).
 *
 * Idea: el cron externo pega UNA vez por hora (lo más simple), y acá decidimos
 * si de verdad corresponde correr, según la hora de Argentina:
 *  - Horario de oficina (09:00–19:00): cada 1 hora.
 *  - Fuera de oficina: cada N horas (default 6).
 *
 * Así nunca corre más seguido de lo permitido (menos huella anti-bot), sin
 * importar con qué frecuencia lo pinchen. Configurable por env.
 */

const OFFICE_START = Number(process.env.SCRAPER_OFFICE_START ?? 9); // hora inclusiva
const OFFICE_END = Number(process.env.SCRAPER_OFFICE_END ?? 19); // hora inclusiva
const OFFHOURS_HOURS = Number(process.env.SCRAPER_OFFHOURS_INTERVAL_HOURS ?? 6);
const TOLERANCE_MIN = 5; // margen para que el cron horario no se "pase" por segundos

/** Hora (0-23) en horario de Argentina, sin importar el TZ del server. */
export function argentinaHour(date: Date = new Date()): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number(s) % 24;
}

export type ScheduleDecision = {
  run: boolean;
  reason: "first_run" | "due" | "throttled";
  hour: number;
  office: boolean;
  minIntervalMin: number;
  elapsedMin: number | null;
};

/** Decide si corresponde correr ahora, dado cuándo fue la última corrida. */
export function decideRun(lastRunAt: Date | null, now: Date = new Date()): ScheduleDecision {
  const hour = argentinaHour(now);
  const office = hour >= OFFICE_START && hour <= OFFICE_END;
  const minIntervalMin = office ? 60 : OFFHOURS_HOURS * 60;

  if (!lastRunAt) {
    return { run: true, reason: "first_run", hour, office, minIntervalMin, elapsedMin: null };
  }

  const elapsedMin = (now.getTime() - lastRunAt.getTime()) / 60_000;
  const run = elapsedMin >= minIntervalMin - TOLERANCE_MIN;
  return {
    run,
    reason: run ? "due" : "throttled",
    hour,
    office,
    minIntervalMin,
    elapsedMin: Math.round(elapsedMin),
  };
}
