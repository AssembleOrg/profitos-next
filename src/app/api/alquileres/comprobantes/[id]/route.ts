import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";

/** Revisión de un comprobante subido por el inquilino: aprobar o rechazar (con motivo). */
export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json()) as { status?: string; reviewNote?: string };
  if (body.status !== "aprobado" && body.status !== "rechazado" && body.status !== "pendiente") {
    throw new AppError(400, "Estado inválido");
  }
  if (body.status === "rechazado" && !body.reviewNote?.trim()) {
    throw new AppError(400, "Contale al inquilino por qué lo rechazás");
  }
  const exists = await prisma.rentalServiceProof.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, "Comprobante no encontrado");
  const proof = await prisma.rentalServiceProof.update({
    where: { id },
    data: {
      status: body.status,
      reviewNote: body.reviewNote?.trim().slice(0, 500) || null,
      reviewedByUserId: body.status === "pendiente" ? null : auth.userId,
      reviewedAt: body.status === "pendiente" ? null : new Date(),
    },
  });
  return ok(proof, "Comprobante actualizado", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;
  await prisma.rentalServiceProof.delete({ where: { id } }).catch(() => {
    throw new AppError(404, "Comprobante no encontrado");
  });
  return ok(null, "Comprobante eliminado", path);
});
