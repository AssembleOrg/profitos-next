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
import { publishDraftViaBrowser } from "@/lib/zonaprop/browser-publish";
import type { DraftInput } from "@/lib/zonaprop/publish";
import { createFicha, type FichaInput } from "@/lib/argenprop/publish";
import { resolveLocation } from "@/lib/argenprop/location";

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
} as const;

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

function mapZonaprop(p: PropertyForPublish): DraftInput {
  return {
    // Tipo fijo (Casa/venta) a nivel borrador; el tipo/subtipo exacto es Fase 4.
    operation: { operationType: zpOperationType(p.operationType), realEstateTypeId: "1", realEstateSubTypeId: "42" },
    description: { title: titleFor(p), description: descriptionFor(p) },
  };
}

async function runZonaprop(p: PropertyForPublish): Promise<{ externalId: string; permalink: string }> {
  const id = await publishDraftViaBrowser(mapZonaprop(p));
  return {
    externalId: id,
    permalink: `https://www.zonaprop.com.ar/panel/publicador-profesionales/edition?postingId=${id}`,
  };
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

async function runArgenprop(p: PropertyForPublish): Promise<{ externalId: string; permalink: string }> {
  const id = await createFicha(await mapArgenprop(p));
  return { externalId: id, permalink: `https://gestion.argenprop.com/avisos/editar/${id}/datosinmueble` };
}

// ─── Cola ────────────────────────────────────────────────────────────────────

/** Encola una publicación y marca la publicación como "publishing". Idempotente por (propertyId,portal). */
export async function enqueuePublish(propertyId: string, portal: PublishPortal, action = "publish"): Promise<string> {
  const job = await prisma.publishJob.create({ data: { propertyId, portal, action, status: "pending" } });
  await prisma.propertyPublication.upsert({
    where: { propertyId_portal: { propertyId, portal } },
    create: { propertyId, portal, status: "publishing" },
    update: { status: "publishing", lastError: null },
  });
  return job.id;
}

async function runPortal(portal: PublishPortal, p: PropertyForPublish) {
  return portal === "zonaprop" ? runZonaprop(p) : runArgenprop(p);
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
    const { externalId, permalink } = await runPortal(portal, property);
    await prisma.propertyPublication.upsert({
      where: { propertyId_portal: { propertyId: job.propertyId, portal } },
      create: { propertyId: job.propertyId, portal, externalId, permalink, status: "draft", publishedAt: new Date() },
      update: { externalId, permalink, status: "draft", lastError: null, publishedAt: new Date() },
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
