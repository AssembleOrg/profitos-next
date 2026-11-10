import { NextResponse, type NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { ensureReceiptPdf, renderOfficeReceiptPdf } from "@/lib/rentals/collect";

/**
 * Abre el PDF de un recibo para imprimir en la oficina: dos hojas, el original
 * y la copia que queda en la inmobiliaria (aclaración de la firma en blanco).
 * ?regenerar=1 vuelve a dibujar también el original guardado (el del portal).
 */
export const GET = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  const receipt = await prisma.rentalReceipt.findUnique({ where: { id }, select: { id: true, transactionId: true } });
  if (!receipt) throw new AppError(404, "Recibo no encontrado");
  if (!receipt.transactionId) throw new AppError(409, "Es un número anulado sin recibo");

  // El original guardado es el que baja el inquilino desde el portal. Si no se
  // puede guardar ahora, el portal lo reintenta: no frena la impresión.
  try {
    await ensureReceiptPdf(id, { force: request.nextUrl.searchParams.get("regenerar") === "1" });
  } catch (err) {
    console.error("[Recibo v2] No se pudo guardar el original:", err);
  }

  const { bytes, filename } = await renderOfficeReceiptPdf(id);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  }) as never;
});
