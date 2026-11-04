"use client";

/** Registro de actividad de la web. Nunca rompe la página: si algo falla, se pierde el evento. */

type Pending = Record<string, unknown> & { id: string; type: string };

const ANON_KEY = "jw-anon";
const SESSION_KEY = "jw-sesion";
const SOURCE_KEY = "jw-origen";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const ENDPOINT = "/web/actividad";

const queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function uuid(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function newEventId(): string {
  return uuid();
}

export function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function sessionId(): string {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { id: string; at: number } | null;
    const id = saved && Date.now() - saved.at < SESSION_IDLE_MS ? saved.id : uuid();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: Date.now() }));
    return id;
  } catch {
    return uuid();
  }
}

/** De dónde llegó: se fija en la primera página de cada pestaña. */
function source(): { referrer: string | null; utm: Record<string, string | null> } {
  try {
    const saved = sessionStorage.getItem(SOURCE_KEY);
    if (saved) return JSON.parse(saved);
    const params = new URLSearchParams(location.search);
    const external = document.referrer && new URL(document.referrer).host !== location.host ? document.referrer : null;
    const value = { referrer: external, utm: { source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign") } };
    sessionStorage.setItem(SOURCE_KEY, JSON.stringify(value));
    return value;
  } catch {
    return { referrer: null, utm: {} };
  }
}

export function flushEvents(final = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue.splice(0, 40);
  const body = JSON.stringify({ anonId: anonId(), sessionId: sessionId(), events, ...source() });
  try {
    if (final && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Sin registro no se rompe nada.
  }
  if (queue.length) flushEvents(final);
}

export function sendEvent(event: Pending, immediate = false) {
  queue.push(event);
  if (immediate) return flushEvents();
  if (!timer) timer = setTimeout(() => flushEvents(), 2500);
}

export function track(type: string, data: Record<string, unknown> = {}) {
  sendEvent({ id: uuid(), type, path: location.pathname + location.search, propertyKey: propertyKeyFromPath(location.pathname), ...data });
}

export function propertyKeyFromPath(pathname: string): string | undefined {
  return pathname.match(/\/web\/p\/([^-/]+)/)?.[1];
}
