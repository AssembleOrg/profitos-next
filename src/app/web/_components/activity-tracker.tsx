"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { flushEvents, newEventId, propertyKeyFromPath, sendEvent, track } from "./tracker";

const HEARTBEAT_MS = 15_000;
const IDLE_MS = 60_000;

/**
 * Una visita por página. El tiempo cuenta solo con la pestaña a la vista y la persona
 * activa en el último minuto: dejar la ficha abierta no suma "interés".
 */
export function ActivityTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const id = newEventId();
    const path = search ? `${pathname}?${search}` : pathname;
    const propertyKey = propertyKeyFromPath(pathname);
    let engaged = 0;
    let lastTick = Date.now();
    let lastActive = Date.now();
    let depth = 0;

    const measureScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      depth = Math.max(depth, max > 0 ? Math.round((scrollY / max) * 100) : 100);
    };
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastActive < IDLE_MS) engaged += now - lastTick;
      lastTick = now;
    };
    const report = (final = false) => {
      tick();
      sendEvent({ id, type: "page_view", path, propertyKey, durationMs: engaged, scrollDepth: depth }, !final);
      if (final) flushEvents(true);
    };
    const active = () => {
      lastActive = Date.now();
    };
    const onScroll = () => {
      active();
      measureScroll();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") report(true);
      else lastTick = Date.now();
    };
    const onPageHide = () => report(true);

    measureScroll();
    sendEvent({ id, type: "page_view", path, propertyKey, durationMs: 0, scrollDepth: depth }, true);
    const interval = setInterval(() => report(), HEARTBEAT_MS);
    addEventListener("scroll", onScroll, { passive: true });
    for (const name of ["pointerdown", "keydown", "touchstart"]) addEventListener(name, active, { passive: true });
    document.addEventListener("visibilitychange", onHidden);
    addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      removeEventListener("scroll", onScroll);
      for (const name of ["pointerdown", "keydown", "touchstart"]) removeEventListener(name, active);
      document.removeEventListener("visibilitychange", onHidden);
      removeEventListener("pagehide", onPageHide);
      report();
    };
  }, [pathname, search]);

  // Los contactos se detectan por el enlace: no depende de acordarse de marcar cada botón.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest?.<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const label = link.dataset.trackLabel;
      const href = link.getAttribute("href") ?? "";
      if (href.includes("wa.me/")) track(label ? "development_click" : "whatsapp_click", { label });
      else if (href.startsWith("tel:")) track("phone_click", { label });
      else if (href.startsWith("mailto:")) track("email_click", { label });
      else return;
      flushEvents(true);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
