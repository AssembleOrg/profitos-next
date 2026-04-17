import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";

const BUCKET = "tasaciones";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const SIGNED_URL_EXPIRY = 3600; // 1 hour

export async function POST(request: NextRequest) {
  try {
    await getAuthContext();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se envió archivo" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "El archivo excede 10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const avifBuffer = await sharp(buffer)
      .avif({ quality: 75 })
      .toBuffer();

    const timestamp = Date.now();
    const safeName = file.name
      .replace(/\.[^.]+$/, "")
      .replaceAll(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);
    const filePath = `${safeName}_${timestamp}.avif`;

    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, avifBuffer, {
        contentType: "image/avif",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Supabase error:", uploadError);
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 });
    }

    // Generate signed URL for preview
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (signError || !signedData) {
      console.error("[Upload] Sign error:", signError);
      return NextResponse.json({ error: "Archivo subido pero no se pudo generar preview" }, { status: 500 });
    }

    return NextResponse.json({
      path: filePath,           // stored in DB
      previewUrl: signedData.signedUrl,  // temporary for frontend preview
    });
  } catch (err) {
    console.error("[Upload] Error:", err);
    return NextResponse.json({ error: "Error al procesar el archivo" }, { status: 500 });
  }
}
