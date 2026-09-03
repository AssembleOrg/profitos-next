import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Fotos de propiedades en Supabase Storage (bucket público `property-photos`).
 * Layout heredado de la migración desde Tokko:
 *   properties/{propertyId}/{key}.jpg        → imagen (máx 1600px)
 *   properties/{propertyId}/{key}_thumb.jpg  → miniatura (máx 480px)
 *   properties/{propertyId}/{key}_orig.jpg   → original (máx 2400px)
 * El JSON `Property.photos` guarda una entrada por foto con las 3 URLs.
 */
export const PHOTOS_BUCKET = "property-photos";

export type PhotoEntry = {
  image: string;
  thumb: string;
  original: string;
  order: number;
  description: string | null;
  is_front_cover: boolean;
  is_blueprint: boolean;
  /** Rastro de la foto en Tokko (sólo fotos migradas). */
  tokko?: unknown;
  social_media_url?: string | null;
};

const VARIANTS = [
  { suffix: "", max: 1600, quality: 84 },
  { suffix: "_thumb", max: 480, quality: 80 },
  { suffix: "_orig", max: 2400, quality: 88 },
] as const;

export function publicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;
}

/** Path dentro del bucket a partir de una URL pública nuestra; null si es externa. */
export function pathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${PHOTOS_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** Genera las 3 variantes, las sube y devuelve la entrada para el JSON. */
export async function uploadPropertyPhoto(propertyId: string, input: Buffer, order: number): Promise<PhotoEntry> {
  const key = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const base = sharp(input, { failOn: "none" }).rotate(); // respeta EXIF
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Archivo de imagen inválido");

  const sb = supabaseAdmin();
  const urls: Record<string, string> = {};
  for (const v of VARIANTS) {
    const buf = await base
      .clone()
      .resize({ width: v.max, height: v.max, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: v.quality, mozjpeg: true })
      .toBuffer();
    const path = `properties/${propertyId}/${key}${v.suffix}.jpg`;
    const { error } = await sb.storage.from(PHOTOS_BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
    if (error) throw new Error(`Storage: ${error.message}`);
    urls[v.suffix] = publicUrl(path);
  }
  return {
    image: urls[""],
    thumb: urls["_thumb"],
    original: urls["_orig"],
    order,
    description: null,
    is_front_cover: false,
    is_blueprint: false,
  };
}

/** Borra del bucket las variantes de una entrada (ignora URLs externas). */
export async function deletePhotoFiles(entry: Pick<PhotoEntry, "image" | "thumb" | "original">): Promise<void> {
  const paths = [...new Set([entry.image, entry.thumb, entry.original].map(pathFromUrl).filter((p): p is string => Boolean(p)))];
  if (!paths.length) return;
  const { error } = await supabaseAdmin().storage.from(PHOTOS_BUCKET).remove(paths);
  if (error) console.warn("[fotos] no se pudieron borrar archivos:", error.message);
}

/** Normaliza el JSON crudo de la DB a entradas válidas y ordenadas. */
export function normalizeEntries(raw: unknown): PhotoEntry[] {
  const arr = Array.isArray(raw) ? (raw as Partial<PhotoEntry>[]) : [];
  return arr
    .filter((p) => p && typeof p.image === "string" && p.image)
    .map((p, i) => ({
      image: p.image as string,
      thumb: p.thumb || (p.image as string),
      original: p.original || (p.image as string),
      order: typeof p.order === "number" ? p.order : i,
      description: p.description || null,
      is_front_cover: Boolean(p.is_front_cover),
      is_blueprint: Boolean(p.is_blueprint),
      ...(p.tokko !== undefined ? { tokko: p.tokko } : {}),
      ...(p.social_media_url !== undefined ? { social_media_url: p.social_media_url } : {}),
    }))
    .sort((a, b) => a.order - b.order)
    .map((p, i) => ({ ...p, order: i }));
}
