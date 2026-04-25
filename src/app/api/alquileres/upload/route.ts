import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getAuthContext } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { slugifyFilename } from "@/lib/rentals";

const BUCKET = "recibos";
const MAX_SIZE = 25 * 1024 * 1024;
const SIGNED_URL_EXPIRY = 3600;

type AttachmentKind = "image" | "audio" | "video" | "file";

function detectKind(mime: string): AttachmentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

function guessExt(mime: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "video/webm": "webm",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

export async function POST(request: NextRequest) {
  try {
    await getAuthContext();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se envió archivo" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "El archivo excede 25MB" }, { status: 400 });

    const kind = detectKind(file.type);
    const supabase = await createClient();
    const timestamp = Date.now();
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const safeBase = slugifyFilename(baseName).slice(0, 60) || "archivo";

    let buffer: Buffer;
    let contentType: string;
    let ext: string;
    let finalName = file.name;

    if (kind === "image") {
      const original = Buffer.from(await file.arrayBuffer());
      buffer = await sharp(original).avif({ quality: 75 }).toBuffer();
      contentType = "image/avif";
      ext = "avif";
      finalName = `${safeBase}.avif`;
    } else {
      buffer = Buffer.from(await file.arrayBuffer());
      // Stripear parámetros del MIME (ej. "audio/webm;codecs=opus" → "audio/webm").
      const rawMime = file.type || "application/octet-stream";
      contentType = rawMime.split(";")[0].trim() || "application/octet-stream";
      const originalExt = file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? "";
      ext = slugifyFilename(originalExt).slice(0, 8) || guessExt(contentType);
    }

    const filePath = `adjuntos/${safeBase}_${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType, upsert: false });

    if (uploadError) {
      console.error("[Recibos Upload] Error:", uploadError);
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 });
    }

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    return NextResponse.json({
      attachment: {
        kind,
        path: filePath,
        name: finalName,
        size: buffer.byteLength,
        mime: contentType,
      },
      previewUrl: signed?.signedUrl ?? null,
    });
  } catch (err) {
    console.error("[Recibos Upload] Error:", err);
    return NextResponse.json({ error: "Error al procesar el archivo" }, { status: 500 });
  }
}
