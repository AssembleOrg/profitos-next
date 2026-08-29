/**
 * Capa de publicación multi-portal (ZonaProp / ArgenProp).
 *
 * Arquitectura: la web NO publica directo (ZonaProp necesita navegador+proxy que
 * solo el worker de Railway tiene). La web ENCOLA un PublishJob y el worker lo
 * procesa en su corrida (processPendingPublishJobs). El estado por propiedad/
 * portal vive en PropertyPublication.
 *
 * NOTA (Fase framework): los motores crean BORRADORES (draft). El mapeo completo
 * de campos (fotos, características finas, tipo exacto, activación) es Fase 4.
 * MercadoLibre NO pasa por acá (publica sync vía su wizard propio).
 */
import { prisma } from "@/lib/prisma/client";
import { publishViaBrowser, type FullPublishInput, type PhotoSource } from "@/lib/zonaprop/browser-publish";
import type { Feature } from "@/lib/zonaprop/publish";
import { createFicha, type FichaInput } from "@/lib/argenprop/publish";
import { resolveLocation } from "@/lib/argenprop/location";

/** Responsable ZonaProp (userId que recibe las consultas). Opcional. */
const ZP_RESPONSIBLE_USER_ID = process.env.ZONAPROP_RESPONSIBLE_USER_ID?.trim() || undefined;

export type PublishPortal = "zonaprop" | "argenprop";
export const PUBLISH_PORTALS: PublishPortal[] = ["zonaprop", "argenprop"];

export function isPublishPortal(v: string): v is PublishPortal {
  return (PUBLISH_PORTALS as string[]).includes(v);
}

type PropertyForPublish = {
  id: string;
  type: string | null;
  operationType: string | null;
  operationPrice: number | null;
  operationCurrency: string | null;
  publicationTitle: string | null;
  address: string;
  description: string | null;
  province: string | null;
  city: string | null;
  zone: string | null;
  bedrooms: number | null;
  bathroomAmount: number | null;
  roomAmount: number | null;
  roofedSurface: number | null;
  totalSurface: number | null;
  age: number | null;
  parkingLotAmount: number | null;
  geoLat: number | null;
  geoLong: number | null;
  photos: unknown;
};

const PROPERTY_SELECT = {
  id: true,
  type: true,
  operationType: true,
  operationPrice: true,
  operationCurrency: true,
  publicationTitle: true,
  address: true,
  description: true,
  province: true,
  city: true,
  zone: true,
  bedrooms: true,
  bathroomAmount: true,
  roomAmount: true,
  roofedSurface: true,
  totalSurface: true,
  age: true,
  parkingLotAmount: true,
  geoLat: true,
  geoLong: true,
  photos: true,
} as const;

/** Extrae URLs de fotos del campo Json `photos` (soporta [url] o [{url}]). */
function photoUrls(photos: unknown): PhotoSource[] {
  if (!Array.isArray(photos)) return [];
  const urls: string[] = [];
  for (const p of photos) {
    if (typeof p === "string") urls.push(p);
    else if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      const u = o.image ?? o.url ?? o.src ?? o.photo;
      if (typeof u === "string") urls.push(u);
    }
  }
  return urls.filter((u) => /^https?:\/\//.test(u)).map((url) => ({ url }));
}

function titleFor(p: PropertyForPublish): string {
  const base = (p.publicationTitle || p.address || "Propiedad").trim();
  // ZonaProp/ArgenProp exigen mínimo de longitud en el título.
  return base.length >= 15 ? base : `${base} — ${p.city ?? p.province ?? "Venta"}`.padEnd(15, " ").trim();
}

function descriptionFor(p: PropertyForPublish): string {
  const base = (p.description || p.publicationTitle || p.address || "").trim();
  const filler =
    " Consultá por este inmueble. Publicación generada automáticamente; revisá y completá los datos en el portal.";
  return (base + filler).length >= 50 ? base + filler : (base + filler).padEnd(50, ".");
}

// ─── ZonaProp ────────────────────────────────────────────────────────────────
function zpOperationType(op: string | null): string {
  const s = (op ?? "").toLowerCase();
  if (s.includes("temporal")) return "3";
  if (s.includes("alquiler")) return "2";
  return "1"; // venta (default)
}

// Códigos real_estate_type_id de ZonaProp (de docs/ZONAPROP-PUBLISH.md).
// El subtipo solo se conoce para Casa (42); para el resto null (STEP_OPERATION
// lo acepta y el aviso queda para completar en el portal).
function zpRealEstateType(type: string | null): { id: string; sub: string | null } {
  const s = (type ?? "").toLowerCase();
  if (s.includes("depart")) return { id: "2", sub: null };
  if (s.includes("ph")) return { id: "2001", sub: null };
  if (s.includes("terren") || s.includes("lote")) return { id: "26", sub: null };
  if (s.includes("local")) return { id: "5", sub: null };
  return { id: "1", sub: "42" }; // casa (default, subtipo conocido)
}

function zpCurrency(cur: string | null): string {
  return (cur ?? "USD").toUpperCase().includes("ARS") ? "ARS" : "USD";
}

// Características principales → features CFT (códigos relevados de la captura).
function zpMainFeatures(p: PropertyForPublish): Feature[] {
  const f: Feature[] = [];
  const add = (id: string, v: number | null, unit?: string) => {
    if (v !== null && v !== undefined && !Number.isNaN(v)) f.push({ feature_id: id, value: v, value_unit: unit });
  };
  add("CFT100", p.totalSurface, "1"); // superficie total (m2)
  add("CFT101", p.roofedSurface, "1"); // superficie cubierta (m2)
  add("CFT2", p.roomAmount); // ambientes
  add("CFT1", p.bedrooms); // dormitorios
  add("CFT3", p.bathroomAmount); // baños
  add("CFT7", p.parkingLotAmount); // cocheras
  add("CFT5", p.age); // antigüedad
  return f;
}

function mapZonaprop(p: PropertyForPublish): FullPublishInput {
  const t = zpRealEstateType(p.type);
  const main = zpMainFeatures(p);
  const input: FullPublishInput = {
    draft: {
      operation: { operationType: zpOperationType(p.operationType), realEstateTypeId: t.id, realEstateSubTypeId: t.sub },
      description: { title: titleFor(p), description: descriptionFor(p) },
      ...(main.length ? { main } : {}),
      ...(p.operationPrice
        ? { price: { currency: zpCurrency(p.operationCurrency), amount: Math.round(p.operationPrice) } }
        : {}),
    },
    photos: photoUrls(p.photos),
    responsibleUserId: ZP_RESPONSIBLE_USER_ID,
  };
  if (p.geoLat && p.geoLong) {
    input.coords = { lat: p.geoLat, lng: p.geoLong, address: p.address };
  }
  return input;
}

async function runZonaprop(
  p: PropertyForPublish,
  activate?: { plan: string }
): Promise<{ externalId: string; permalink: string; active: boolean }> {
  const input = mapZonaprop(p);
  if (activate) input.activate = { publicationPlan: activate.plan };
  const r = await publishViaBrowser(input);
  return { externalId: r.postingId, permalink: r.permalink, active: r.published };
}

// ─── ArgenProp ───────────────────────────────────────────────────────────────
function apOperationType(op: string | null): string {
  return (op ?? "").toLowerCase().includes("alquiler") ? "ALQUILER" : "VENTA";
}

function apPropertyType(type: string | null): string {
  const s = (type ?? "").toLowerCase();
  if (s.includes("depart")) return "DEPARTAMENTO";
  if (s.includes("ph")) return "PH";
  if (s.includes("terren") || s.includes("lote")) return "TERRENO";
  if (s.includes("local")) return "LOCAL";
  if (s.includes("oficina")) return "OFICINA";
  return "CASA";
}

async function mapArgenprop(p: PropertyForPublish): Promise<FichaInput> {
  const loc = await resolveLocation({ province: p.province, city: p.city, locality: p.city, zone: p.zone });
  const tipo = apPropertyType(p.type);
  return {
    tipoPropiedad: tipo,
    tipoUnidad: tipo,
    tipoOperacion: apOperationType(p.operationType),
    moneda: (p.operationCurrency ?? "USD").toUpperCase().includes("ARS") ? "ARS" : "USD",
    precio: p.operationPrice ? String(Math.round(p.operationPrice)) : "0",
    titulo: titleFor(p),
    descripcion: descriptionFor(p),
    location: {
      idProvincia: loc.idProvincia,
      idPartido: loc.idPartido,
      idLocalidad: loc.idLocalidad,
      idBarrio: loc.idBarrio,
      nombreCalle: p.address || "Sin calle",
      numeroCalle: "",
    },
    caracteristicas: {
      ambientes: p.roomAmount ?? undefined,
      dormitorios: p.bedrooms ?? undefined,
      banos: p.bathroomAmount ?? undefined,
      superficieCubierta: p.roofedSurface ?? undefined,
    },
  };
}

async function runArgenprop(p: PropertyForPublish): Promise<{ externalId: string; permalink: string; active: boolean }> {
  const id = await createFicha(await mapArgenprop(p));
  return { externalId: id, permalink: `https://gestion.argenprop.com/avisos/editar/${id}/datosinmueble`, active: false };
}

// ─── Cola ────────────────────────────────────────────────────────────────────

// Plan por defecto al activar en ZonaProp: "3" = Simples (el más barato).
const ZP_DEFAULT_PLAN = "3";

export type EnqueueOpts = { activate?: boolean; plan?: string; action?: string };

/**
 * Encola una publicación y marca la publicación como "publishing". Idempotente
 * por (propertyId,portal). `activate:true` → publica ONLINE (gasta crédito).
 */
export async function enqueuePublish(propertyId: string, portal: PublishPortal, opts: EnqueueOpts = {}): Promise<string> {
  const job = await prisma.publishJob.create({
    data: {
      propertyId,
      portal,
      action: opts.action ?? "publish",
      activate: opts.activate ?? false,
      plan: opts.plan ?? null,
      status: "pending",
    },
  });
  await prisma.propertyPublication.upsert({
    where: { propertyId_portal: { propertyId, portal } },
    create: { propertyId, portal, status: "publishing" },
    update: { status: "publishing", lastError: null },
  });
  return job.id;
}

async function runPortal(
  portal: PublishPortal,
  p: PropertyForPublish,
  activate?: { plan: string }
): Promise<{ externalId: string; permalink: string; active: boolean }> {
  return portal === "zonaprop" ? runZonaprop(p, activate) : runArgenprop(p);
}

/** Procesa un job: corre el motor y actualiza PropertyPublication. Lo llama el worker. */
export async function processPublishJob(jobId: string): Promise<void> {
  const job = await prisma.publishJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "done") return;
  const portal = job.portal;
  if (!isPublishPortal(portal)) {
    await prisma.publishJob.update({ where: { id: jobId }, data: { status: "error", error: `portal inválido: ${portal}`, processedAt: new Date() } });
    return;
  }

  await prisma.publishJob.update({ where: { id: jobId }, data: { status: "running", attempts: { increment: 1 } } });
  const property = await prisma.property.findUnique({ where: { id: job.propertyId }, select: PROPERTY_SELECT });
  if (!property) {
    await prisma.publishJob.update({ where: { id: jobId }, data: { status: "error", error: "propiedad no encontrada", processedAt: new Date() } });
    return;
  }

  try {
    const activate = job.activate && portal === "zonaprop" ? { plan: job.plan ?? ZP_DEFAULT_PLAN } : undefined;
    const { externalId, permalink, active } = await runPortal(portal, property, activate);
    const status = active ? "active" : "draft";
    await prisma.propertyPublication.upsert({
      where: { propertyId_portal: { propertyId: job.propertyId, portal } },
      create: { propertyId: job.propertyId, portal, externalId, permalink, status, publishedAt: new Date() },
      update: { externalId, permalink, status, lastError: null, publishedAt: new Date() },
    });
    await prisma.publishJob.update({ where: { id: jobId }, data: { status: "done", error: null, processedAt: new Date() } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.propertyPublication.upsert({
      where: { propertyId_portal: { propertyId: job.propertyId, portal } },
      create: { propertyId: job.propertyId, portal, status: "error", lastError: msg },
      update: { status: "error", lastError: msg },
    });
    await prisma.publishJob.update({ where: { id: jobId }, data: { status: "error", error: msg, processedAt: new Date() } });
  }
}

/** Procesa los jobs pendientes (secuencial: un navegador por vez). Lo llama el worker en cada corrida. */
export async function processPendingPublishJobs(limit = 10): Promise<{ processed: number }> {
  const pending = await prisma.publishJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const j of pending) await processPublishJob(j.id);
  return { processed: pending.length };
}
