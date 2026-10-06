import { NextResponse, type NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { ensureReceiptPdf } from "@/lib/rentals/collect";
import { signedReceiptUrl } from "@/lib/rentals/receipt-v2";

/** Abre el PDF de un recibo (lo genera si faltaba). ?regenerar=1 lo vuelve a dibujar. */
export const GET = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const { id } = await context!.params;
  const receipt = await prisma.rentalReceipt.findUnique({ where: { id }, select: { id: true, transactionId: true } });
  if (!receipt) throw new AppError(404, "Recibo no encontrado");
  if (!receipt.transactionId) throw new AppError(409, "Es un número anulado sin recibo");
  const path = await ensureReceiptPdf(id, { force: request.nextUrl.searchParams.get("regenerar") === "1" });
  const url = await signedReceiptUrl(path);
  if (!url) throw new AppError(500, "No se pudo abrir el PDF");
  return NextResponse.redirect(url) as never;
});
