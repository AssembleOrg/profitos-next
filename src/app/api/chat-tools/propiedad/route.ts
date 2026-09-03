import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";

// Tool del chat IA: EDITAR datos básicos de una propiedad (con confirmación del
// lado del chat). Campos acotados a lo que se pide por chat: precio, moneda,
// estado, título de publicación y descripción. Los avisos ya publicados en los
// portales NO se actualizan solos (se re-sincronizan desde la web).
const ESTADOS = ["activa", "vendida", "alquilada", "suspendida"] as const;
const MONEDAS = ["USD", "ARS"] as const;

export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as {
    propertyId?: string;
    referencia?: string;
    direccion?: string;
    precio?: number | string;
    moneda?: string;
    estado?: string;
    titulo?: string;
    descripcion?: string;
    provincia?: string;
    ciudad?: string;
    zona?: string;
    tipo?: string;
    operacion?: string;
    lat?: number | string;
    lng?: number | string;
  };
  const prop = await resolveProperty(body);

  const data: Record<string, unknown> = {};
  const cambios: string[] = [];

  if (body.precio != null && body.precio !== "") {
    const n = typeof body.precio === "number" ? body.precio : Number(String(body.precio).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) throw new AppError(400, `Precio inválido: ${body.precio}`);
    data.operationPrice = n;
    cambios.push(`precio → ${n.toLocaleString("es-AR")}`);
  }
  if (body.moneda) {
    const m = body.moneda.trim().toUpperCase();
    if (!(MONEDAS as readonly string[]).includes(m)) throw new AppError(400, `Moneda inválida: ${body.moneda} (USD o ARS)`);
    data.operationCurrency = m;
    cambios.push(`moneda → ${m}`);
  }
  if (body.estado) {
    const e = body.estado.trim().toLowerCase();
    if (!(ESTADOS as readonly string[]).includes(e)) throw new AppError(400, `Estado inválido: ${body.estado} (${ESTADOS.join(", ")})`);
    data.status = e;
    cambios.push(`estado → ${e}`);
  }
  if (body.titulo?.trim()) {
    data.publicationTitle = body.titulo.trim().slice(0, 200);
    cambios.push("título de publicación");
  }
  if (body.descripcion?.trim()) {
    data.description = body.descripcion.trim().slice(0, 5000);
    cambios.push("descripción");
  }
  if (body.provincia?.trim()) {
    data.province = body.provincia.trim().slice(0, 120);
    cambios.push(`provincia → ${data.province}`);
  }
  if (body.ciudad?.trim()) {
    data.city = body.ciudad.trim().slice(0, 120);
    cambios.push(`localidad → ${data.city}`);
  }
  if (body.zona?.trim()) {
    data.zone = body.zona.trim().slice(0, 120);
    cambios.push(`zona → ${data.zone}`);
  }
  if (body.tipo?.trim()) {
    data.type = body.tipo.trim().slice(0, 60);
    cambios.push(`tipo → ${data.type}`);
  }
  if (body.operacion?.trim()) {
    const o = body.operacion.trim();
    const norm = o.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const val = norm.includes("alquiler") ? "Alquiler" : norm.includes("venta") ? "Venta" : o;
    data.operationType = val;
    cambios.push(`operación → ${val}`);
  }
  const latRaw = body.lat, lngRaw = body.lng;
  if (latRaw != null && latRaw !== "" && lngRaw != null && lngRaw !== "") {
    const lat = typeof latRaw === "number" ? latRaw : Number(latRaw);
    const lng = typeof lngRaw === "number" ? lngRaw : Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new AppError(400, "Coordenadas inválidas");
    data.geoLat = lat;
    data.geoLong = lng;
    cambios.push("coordenadas");
  }
  if (!cambios.length) throw new AppError(400, "No indicaste ningún cambio (precio, moneda, estado, titulo, descripcion, provincia, ciudad, zona, tipo, operacion o coordenadas)");

  await prisma.property.update({ where: { id: prop.id }, data });
  console.log(`[chat-tools] ${who.email} editó ${prop.id}: ${cambios.join(", ")}`);

  const pubs = await prisma.propertyPublication.findMany({
    where: { propertyId: prop.id, status: { in: ["active", "paused"] } },
    select: { portal: true },
  });
  return ok(
    {
      propiedad: prop,
      cambios,
      aviso: pubs.length
        ? `La propiedad está publicada en ${pubs.map((p) => p.portal).join(", ")}: los avisos NO se actualizan solos, hay que re-sincronizarlos desde Propiedades → Portales.`
        : null,
    },
    `Propiedad ${prop.direccion} actualizada (${cambios.join(", ")})`,
    request.nextUrl.pathname
  );
});
