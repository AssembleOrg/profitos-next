import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

/** El staff carga un comprobante de servicio en nombre del inquilino (queda aprobado). */
export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json()) as Record<string, unknown>;
  const service = typeof body.service === "string" ? body.service.trim().slice(0, 40) : "";
  const period = typeof body.period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.period) ? body.period : "";
  if (!service) throw new AppError(400, "Indicá el servicio");
  if (!period) throw new AppError(400, "Indicá el período (mes)");
  const contract = await prisma.rentalContract.findUnique({ where: { id }, select: { id: true } });
  if (!contract) throw new AppError(404, "Contrato no encontrado");
  const amount = typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount >= 0 ? body.amount : null;
  const proof = await prisma.rentalServiceProof.create({
    data: {
      contractId: id,
      service,
      period,
      amount,
      attachments: (Array.isArray(body.attachments) ? body.attachments : []) as Prisma.InputJsonValue,
      notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || null : null,
      status: "aprobado",
      uploadedByTenant: false,
      reviewedByUserId: auth.userId,
      reviewedAt: new Date(),
    },
  });
  return created(proof, "Comprobante cargado", path);
});
