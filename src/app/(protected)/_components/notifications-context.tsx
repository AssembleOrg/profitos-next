"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useNotifications } from "./use-notifications";

type NotificationsContextValue = ReturnType<typeof useNotifications>;

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * Ejecuta la lógica de notificaciones UNA sola vez (un fetch + un canal de
 * realtime) y la comparte con el sidebar y el bottom-nav. Antes cada uno
 * montaba su propia copia → doble request a recent-contacts y doble canal.
 */
export function NotificationsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const value = useNotifications();
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotificationsContext must be used within NotificationsProvider");
  return ctx;
}
