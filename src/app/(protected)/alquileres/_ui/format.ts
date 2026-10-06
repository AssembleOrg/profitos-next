/**
 * Formatos de alquileres (montos, fechas, direcciones). Módulo neutro: lo usan
 * páginas server y componentes cliente.
 */
import { DateTime } from "luxon";
import { formatARNumber } from "@/lib/rentals";

export function money(amount: number, currency = "ARS") {
  return `${currency === "USD" ? "U$D" : "$"}\u00a0${formatARNumber(Math.round(amount))}`;
}

/** $ 1,0 M · $ 905 k — para chips del calendario. */
export function moneyShort(amount: number, currency = "ARS") {
  const sign = currency === "USD" ? "U$D" : "$";
  if (amount >= 1_000_000) {
    return `${sign} ${(amount / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: amount >= 10_000_000 ? 0 : 1 })} M`;
  }
  if (amount >= 1000) return `${sign} ${Math.round(amount / 1000).toLocaleString("es-AR")} k`;
  return `${sign} ${Math.round(amount)}`;
}

export function dayLong(iso: string) {
  return DateTime.fromISO(iso, { zone: "utc" }).setLocale("es").toFormat("cccc d 'de' LLLL");
}

export function dayShort(iso: string) {
  return DateTime.fromISO(iso, { zone: "utc" }).setLocale("es").toFormat("d LLL");
}

export function dateAR(iso: string) {
  return DateTime.fromISO(iso.slice(0, 10), { zone: "utc" }).toFormat("dd/MM/yyyy");
}

export function monthLabel(month: string) {
  const s = DateTime.fromISO(`${month}-01`, { zone: "utc" }).setLocale("es").toFormat("LLLL yyyy");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shiftMonth(month: string, delta: number) {
  return DateTime.fromISO(`${month}-01`, { zone: "utc" }).plus({ months: delta }).toFormat("yyyy-MM");
}

export function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function propertyLine(address: string, unit?: string | null) {
  return unit ? `${address} · ${unit}` : address;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
