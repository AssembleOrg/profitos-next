import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import type { Prisma } from "@/generated/prisma/client";
import { deletePhotoFiles, normalizeEntries, uploadPropertyPhoto, type PhotoEntry } from "@/lib/photos/storage";

// Fotos de una propiedad (bucket property-photos + JSON Property.photos).
//  GET    → galería (bajo demanda: el listado paginado no trae fotos).
//  POST   → multipart `files` (varias): genera variantes, sube y agrega.
//  PUT    → { order?: string[] (URLs image en orden), cover?: string (URL image) }
//  DELETE → { image: string } borra la foto (archivos + JSON).
// Todas devuelven la galería actualizada en el mismo formato que GET.

const MAX_FILE = 15 * 1024 * 1024;
const MAX_PHOTOS = 60;

function toApi(entries: PhotoEntry[]) {
  return entries.map((p) => ({
    image: p.image,
    thumb: p.thumb,
    original: p.original,
    order: p.order,
    description: p.description,
    isFrontCover: p.is_front_cover,
    isBlueprint: p.is_blueprint,
  }));
}

async function load(id: string) {
  const property = await prisma.property.findUnique({ where: { id }, select: { photos: true, coverImageUrl: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");
  return { entries: normalizeEntries(property.photos), coverImageUrl: property.coverImageUrl };
}

/** Persiste entradas + portada coherente (la marcada, si no la primera). */
async function save(id: string, entries: PhotoEntry[], coverWanted?: string | null) {
  const ordered = entries.map((p, i) => ({ ...p, order: i }));
  const cover = coverWanted && ordered.some((p) => p.image === coverWanted) ? coverWanted : (ordered[0]?.image ?? null);
  const final = ordered.map((p) => ({ ...p, is_front_cover: p.image === cover }));
  await prisma.property.update({
    where: { id },
    data: { photos: final as unknown as Prisma.InputJsonValue, coverImageUrl: cover },
  });
  return { entries: final, coverImageUrl: cover };
}

export const GET = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  const { entries, coverImageUrl } = await load(id);
  return ok({ photos: toApi(entries), coverImageUrl }, "Fotos obtenidas", request.nextUrl.pathname);
});

export const POST = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  const form = await request.formData().catch(() => null);
  if (!form) throw new AppError(400, "Se esperaba multipart/form-data con `files`");
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new AppError(400, "No llegó ningún archivo");

  const { entries, coverImageUrl } = await load(id);
  if (entries.length + files.length > MAX_PHOTOS) throw new AppError(400, `Máximo ${MAX_PHOTOS} fotos por propiedad`);

  const nuevas: PhotoEntry[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE) throw new AppError(400, `${f.name}: supera 15 MB`);
    if (!/^image\//.test(f.type)) throw new AppError(400, `${f.name}: no es una imagen`);
    const buf = Buffer.from(await f.arrayBuffer());
    try {
      nuevas.push(await uploadPropertyPhoto(id, buf, entries.length + nuevas.length));
    } catch (e) {
      throw new AppError(400, `${f.name}: ${e instanceof Error ? e.message : "no se pudo procesar"}`);
    }
  }
  const saved = await save(id, [...entries, ...nuevas], coverImageUrl);
  return ok(
    { photos: toApi(saved.entries), coverImageUrl: saved.coverImageUrl, agregadas: nuevas.length },
    `${nuevas.length} foto(s) agregada(s)`,
    request.nextUrl.pathname
  );
});

export const PUT = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json().catch(() => ({}))) as { order?: string[]; cover?: string };
  const { entries, coverImageUrl } = await load(id);

  let next = entries;
  if (Array.isArray(body.order) && body.order.length) {
    const byImage = new Map(entries.map((p) => [p.image, p]));
    const seen = new Set<string>();
    const reordered: PhotoEntry[] = [];
    for (const img of body.order) {
      const p = byImage.get(img);
      if (p && !seen.has(img)) {
        reordered.push(p);
        seen.add(img);
      }
    }
    // las que no vinieron en la lista quedan al final, en su orden actual
    for (const p of entries) if (!seen.has(p.image)) reordered.push(p);
    next = reordered;
  }
  const cover = body.cover ?? coverImageUrl;
  const saved = await save(id, next, cover);
  return ok({ photos: toApi(saved.entries), coverImageUrl: saved.coverImageUrl }, "Fotos actualizadas", request.nextUrl.pathname);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json().catch(() => ({}))) as { image?: string };
  if (!body.image) throw new AppError(400, "Falta `image`");
  const { entries, coverImageUrl } = await load(id);
  const target = entries.find((p) => p.image === body.image);
  if (!target) throw new AppError(404, "Esa foto no está en la propiedad");

  await deletePhotoFiles(target);
  const saved = await save(id, entries.filter((p) => p.image !== body.image), coverImageUrl === body.image ? null : coverImageUrl);
  return ok({ photos: toApi(saved.entries), coverImageUrl: saved.coverImageUrl }, "Foto eliminada", request.nextUrl.pathname);
});
