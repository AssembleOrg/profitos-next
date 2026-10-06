import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { collectRent } from "@/lib/rentals/collect";
import { sanitizeChargeLines } from "@/lib/rentals/money";

function optNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isInteger(n) || n < 1) throw new AppError(400, "Número de recibo inválido");
  return n;
}

/**
 * Registra un cobro con desglose de conceptos y emite los recibos numerados
 * (inquilino y, si corresponde, propietario).
 */
export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json()) as Record<string, unknown>;

  const paidAt = typeof body.paidAt === "string" && body.paidAt ? new Date(body.paidAt) : null;
  if (paidAt && Number.isNaN(paidAt.getTime())) throw new AppError(400, "Fecha de pago inválida");

  const result = await collectRent({
    dueDateId: id,
    lines: sanitizeChargeLines(body.lines),
    feePercent: typeof body.feePercent === "number" ? body.feePercent : Number.NaN,
    isFull: body.isFull !== false,
    paidAt,
    method: typeof body.method === "string" ? body.method : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    receiptNotes: typeof body.receiptNotes === "string" ? body.receiptNotes : null,
    attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
    tenantReceiptNumber: optNumber(body.tenantReceiptNumber),
    ownerReceiptNumber: optNumber(body.ownerReceiptNumber),
    issueOwnerReceipt: body.issueOwnerReceipt !== false,
    userId: auth.userId,
  });
  return created(result, result.pdfErrors.length ? "Cobro registrado. Algún PDF no se pudo generar." : "Cobro registrado", path);
});
