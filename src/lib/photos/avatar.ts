import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PHOTOS_BUCKET, pathFromUrl, publicUrl } from "./storage";

/**
 * Foto de perfil del equipo: cuadrada 512px, en el bucket público de fotos
 * bajo users/{userId}/. Es la que van a ver los clientes cuando el agente
 * conteste consultas.
 */
const SIZE = 512;

export async function uploadAvatar(userId: string, input: Buffer): Promise<string> {
  const base = sharp(input, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Archivo de imagen inválido");
  const buf = await base
    .resize({ width: SIZE, height: SIZE, fit: "cover", position: "attention" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  const path = `users/${userId}/avatar-${Date.now().toString(36)}.jpg`;
  const { error } = await supabaseAdmin()
    .storage.from(PHOTOS_BUCKET)
    .upload(path, buf, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Storage: ${error.message}`);
  return publicUrl(path);
}

/** Borra una foto de perfil nuestra (ignora URLs de Google u otras). */
export async function deleteAvatarFile(url: string | null | undefined): Promise<void> {
  const path = pathFromUrl(url);
  if (!path || !path.startsWith("users/")) return;
  const { error } = await supabaseAdmin().storage.from(PHOTOS_BUCKET).remove([path]);
  if (error) console.warn("[perfil] no se pudo borrar la foto anterior:", error.message);
}
