import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { updateReceiptBook } from "@/lib/rentals/collect";
import { getReceiptBooks } from "@/lib/rentals/views";
import { prisma } from "@/lib/prisma/client";

/** Lista los talonarios. Con ?tipo=&numero= informa si ese número ya está tomado. */
export const GET = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const kind = request.nextUrl.searchParams.get("tipo");
  const number = Number.parseInt(request.nextUrl.searchParams.get("numero") ?? "", 10);
  if (kind === "inquilino" || kind === "propietario") {
    if (!Number.isInteger(number) || number < 1) throw new AppError(400, "Número inválido");
    const book = await prisma.receiptBook.findUnique({ where: { kind }, select: { pointOfSale: true } });
    const taken = await prisma.rentalReceipt.findUnique({
      where: { bookKind_pointOfSale_number: { bookKind: kind, pointOfSale: book?.pointOfSale ?? 1, number } },
      select: { status: true },
    });
    return ok({ taken: Boolean(taken), status: taken?.status ?? null, pointOfSale: book?.pointOfSale ?? 1 }, "Número", path);
  }
  return ok(await getReceiptBooks(), "Talonarios", path);
});

/** Configura el próximo número (y punto de venta) de un talonario. */
export const PATCH = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const body = (await request.json()) as { kind?: string; nextNumber?: number; pointOfSale?: number };
  if (body.kind !== "inquilino" && body.kind !== "propietario") throw new AppError(400, "Talonario inválido");
  await updateReceiptBook(body.kind, { nextNumber: body.nextNumber, pointOfSale: body.pointOfSale });
  return ok(await getReceiptBooks(), "Talonario actualizado", path);
});
