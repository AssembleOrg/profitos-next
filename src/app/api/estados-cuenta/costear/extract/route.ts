import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { extractCostear, getCostearPhoneForEmail } from "@/lib/costear/client";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB (límite de Costear)

/**
 * Extrae un gasto con IA vía Costear a partir de una imagen, un audio o texto.
 * Devuelve el borrador `proposed` para que la dueña lo revise antes de crear.
 * Solo la dueña (COSTEAR_OWNER_EMAIL). No persiste nada en profitos.
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const phone = getCostearPhoneForEmail(auth.email);
  if (!phone) {
    throw new AppError(403, "No autorizado para usar la extracción de Costear");
  }

  const contentType = request.headers.get("content-type") ?? "";

  let result;
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new AppError(400, "Falta el archivo");
      if (file.size > MAX_BYTES) throw new AppError(400, "El archivo supera los 25 MB");

      const isImage = file.type.startsWith("image/");
      const isAudio = file.type.startsWith("audio/");
      if (!isImage && !isAudio) throw new AppError(400, "Solo se aceptan imágenes o audios");

      result = await extractCostear(phone, {
        kind: isImage ? "photo" : "audio",
        file,
        filename: file.name || (isImage ? "imagen" : "audio"),
      });
    } else {
      const body = (await request.json().catch(() => ({}))) as { text?: string };
      const text = body.text?.trim();
      if (!text || text.length < 3) throw new AppError(400, "Ingresá al menos 3 caracteres");
      result = await extractCostear(phone, { kind: "text", text });
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Errores de Costear (cuota, plan, timeout…) se muestran al usuario.
    const msg = err instanceof Error ? err.message : "Error al extraer con Costear";
    throw new AppError(502, msg);
  }

  if (result.status === "FAILED") {
    throw new AppError(422, result.error || "Costear no pudo procesar el archivo");
  }
  if (result.status === "PROCESSING" || !result.proposed) {
    throw new AppError(504, "Costear sigue procesando; probá de nuevo en unos segundos");
  }

  return ok(
    { extractionId: result.id, type: result.type, transcript: result.transcript, proposed: result.proposed },
    "Extracción completada",
    path
  );
});
