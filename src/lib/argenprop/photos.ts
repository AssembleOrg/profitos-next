/**
 * Subida de fotos a ArgenProp Gestión (flujo pre-signed URL de S3).
 *
 *   1) POST /Api/Wizard/GetPreSignedUrl {extension, count, FileSize}
 *        → [{ key: "t/{uuid}.jpg", url: "https://s3...?X-Amz-firma..." }]
 *   2) PUT los bytes de la imagen a esa url firmada (directo a S3, sin cookies).
 *   3) El `key` se adjunta a la ficha en los campos `file` de datosgeneralespost.
 *
 * (La asociación por campo `file` está inferida de la captura; validar en la
 * primera ficha real con foto.)
 */
import { gestionPostJson } from "./gestion";

type PreSigned = { key: string; url: string };

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function extFromUrl(url: string): string {
  const m = url.split("?")[0].match(/\.([a-z0-9]+)$/i);
  return (m?.[1] ?? "jpg").toLowerCase();
}

/**
 * Sube una imagen y devuelve su `key` (t/{uuid}.ext) para adjuntar a la ficha.
 * `ext` sin punto (jpg, png...).
 */
export async function uploadPhoto(data: ArrayBuffer, ext = "jpg"): Promise<string> {
  const e = ext.replace(/^\./, "").toLowerCase();
  const [pre] = await gestionPostJson<PreSigned[]>("/Api/Wizard/GetPreSignedUrl", {
    extension: e,
    count: 1,
    FileSize: data.byteLength,
  });
  if (!pre?.url || !pre?.key) throw new Error("GetPreSignedUrl no devolvió url/key.");

  const contentType = MIME[e] ?? "application/octet-stream";
  const put = await fetch(pre.url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: new Blob([data], { type: contentType }),
  });
  if (!put.ok) throw new Error(`PUT foto a S3 → ${put.status}`);
  return pre.key;
}

/** Descarga una foto por URL (Supabase/CDN) y la sube. Devuelve el key. */
export async function uploadPhotoFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No pude descargar la foto ${url} (${res.status}).`);
  return uploadPhoto(await res.arrayBuffer(), extFromUrl(url));
}

/** Sube varias fotos (por URL) en orden y devuelve sus keys. */
export async function uploadPhotosFromUrls(urls: string[]): Promise<string[]> {
  const keys: string[] = [];
  for (const u of urls) {
    try {
      keys.push(await uploadPhotoFromUrl(u));
    } catch {
      // una foto que falla no debe tumbar toda la publicación
    }
  }
  return keys;
}
