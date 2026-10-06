import { NextResponse, type NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { requireTenant } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma/client";
import { ensureReceiptPdf } from "@/lib/rentals/collect";
import { signedReceiptUrl } from "@/lib/rentals/receipt-v2";

/** El inquilino descarga SU recibo (solo los "por cuenta de terceros" emitidos). */
export const GET = withHandler(async (_request: NextRequest, context) => {
  const tenant = await requireTenant();
  const { id } = await context!.params;
  const receipt = await prisma.rentalReceipt.findFirst({
    where: { id, bookKind: "inquilino", status: "emitido", contract: { tenantId: tenant.id } },
    select: { id: true },
  });
  if (!receipt) throw new AppError(404, "Recibo no encontrado");
  const path = await ensureReceiptPdf(receipt.id);
  const url = await signedReceiptUrl(path, 120);
  if (!url) throw new AppError(500, "No se pudo abrir el recibo");
  return NextResponse.redirect(url) as never;
});
