import { NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/auth/access";
import { getPeople, getProperties, getSearches, resolveRange, type InsightFilters } from "@/lib/web/server/insights";

/** Excel interpreta `=`, `+`, `-` y `@` iniciales como fórmula: el visitante escribe parte de estos textos. */
function cell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][]): string {
  return `﻿${[headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")}`;
}

export async function GET(request: Request) {
  const access = await getCurrentAccess();
  if (!access?.isAdmin) return new NextResponse(null, { status: 403 });
  const params = new URL(request.url).searchParams;
  const filters = Object.fromEntries(params.entries()) as InsightFilters;
  const range = resolveRange(filters);
  const tab = params.get("tab");
  let body: string;
  if (tab === "personas") {
    const rows = await getPeople(filters, range);
    body = csv(["Nombre", "Email", "Celular", "Interés", "Nivel", "Fichas", "Minutos", "Búsquedas", "Favoritas", "Consultas", "Sesiones", "Novedades", "Primera vez", "Última vez"], rows.map((row) => [row.name, row.email, row.phone, row.score, row.level, row.views, row.minutes, row.searches, row.favorites, row.contacts, row.sessions, row.marketing ? "sí" : "no", row.firstSeen, row.lastSeen]));
  } else if (tab === "busquedas") {
    const { searches } = await getSearches(filters, range);
    body = csv(["Búsqueda", "Veces", "Personas", "Resultados promedio", "Sin resultados"], searches.map((row) => [row.signature, row.count, row.people, row.avgResults, row.zero ? "sí" : "no"]));
  } else {
    const rows = await getProperties(filters, range);
    body = csv(["Dirección", "Tipo", "Zona", "Operación", "Vistas", "Personas", "Segundos promedio", "Minutos totales", "Fotos", "Favoritas", "Consultas", "Consultan %"], rows.map((row) => [row.address, row.type, row.zone, row.operation, row.views, row.people, row.avgSeconds, row.totalMinutes, row.photos, row.favorites, row.contacts, Math.round(row.conversion * 100)]));
  }
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="analitica-web-${tab ?? "propiedades"}.csv"`,
      "cache-control": "no-store",
    },
  });
}
