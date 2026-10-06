import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { voidUnusedNumber } from "@/lib/rentals/collect";

/** Anula un número del talonario que no se usó (hoja rota, salteada, etc.). */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const body = (await request.json()) as { kind?: string; number?: number; reason?: string };
  if (body.kind !== "inquilino" && body.kind !== "propietario") throw new AppError(400, "Talonario inválido");
  const receipt = await voidUnusedNumber(body.kind, Number(body.number), body.reason ?? "", auth.userId);
  return created(receipt, "Número anulado", path);
});
