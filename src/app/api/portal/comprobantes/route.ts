import type { NextRequest } from "next/server";
import sharp from "sharp";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireTenant } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugifyFilename } from "@/lib/rentals";
import { RECEIPTS_BUCKET } from "@/lib/rentals/receipt-v2";
import type { Prisma } from "@/generated/prisma/client";

const MAX_SIZE = 15 * 1024 * 1024;

/**
 * El inquilino sube el comprobante de un servicio que pagó (foto o PDF).
 * Queda "pendiente" hasta que la inmobiliaria lo revisa.
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const tenant = await requireTenant();
  const form = await request.formData();

  const contractId = String(form.get("contractId") ?? "");
  const service = String(form.get("service") ?? "").trim().slice(0, 40);
  const period = String(form.get("period") ?? "");
  const amountRaw = String(form.get("amount") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 500) || null;
  const file = form.get("file");

  if (!service) throw new AppError(400, "Elegí el servicio");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new AppError(400, "Elegí el mes que pagaste");
  if (!(file instanceof File) || file.size === 0) throw new AppError(400, "Adjuntá la foto o el PDF del comprobante");
  if (file.size > MAX_SIZE) throw new AppError(400, "El archivo pesa más de 15 MB");
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) throw new AppError(400, "Subí una foto o un PDF");

  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!contract) throw new AppError(404, "Contrato no encontrado");

  const amount = amountRaw ? Number.parseFloat(amountRaw.replaceAll(".", "").replace(",", ".")) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new AppError(400, "Monto inválido");

  const original = Buffer.from(await file.arrayBuffer());
  const base = slugifyFilename(file.name.replace(/\.[^.]+$/, "")).slice(0, 50) || "comprobante";
  const buffer = isImage ? await sharp(original).rotate().avif({ quality: 70 }).toBuffer() : original;
  const ext = isImage ? "avif" : "pdf";
  const storagePath = `portal/${tenant.id}/${period}_${slugifyFilename(service)}_${base}_${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin()
    .storage.from(RECEIPTS_BUCKET)
    .upload(storagePath, buffer, { contentType: isImage ? "image/avif" : "application/pdf", upsert: false });
  if (error) throw new AppError(500, "No se pudo subir el archivo. Probá de nuevo.");

  const attachment = {
    kind: isImage ? "image" : "file",
    path: storagePath,
    name: isImage ? `${base}.avif` : file.name,
    size: buffer.length,
    mime: isImage ? "image/avif" : "application/pdf",
  };
  const proof = await prisma.rentalServiceProof.create({
    data: {
      contractId: contract.id,
      service,
      period,
      amount,
      notes,
      attachments: [attachment] as unknown as Prisma.InputJsonValue,
      status: "pendiente",
      uploadedByTenant: true,
    },
  });
  return created({ id: proof.id }, "Comprobante enviado", path);
});
