"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { HolidayCalendar } from "@/lib/signatures/reservation-expiry";

/** Feriados del Colegio para que la vista previa calcule igual que el servidor. */
const HolidaysContext = createContext<HolidayCalendar | null>(null);

export function HolidaysProvider({ calendar, children }: Readonly<{ calendar: HolidayCalendar | null; children: ReactNode }>) {
  return <HolidaysContext.Provider value={calendar}>{children}</HolidaysContext.Provider>;
}

export function useHolidayCalendar(): HolidayCalendar | null {
  return useContext(HolidaysContext);
}
