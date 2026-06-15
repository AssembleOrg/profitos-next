import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import {
  assertCanDeleteContract,
  contractInclude,
  getContractOrThrow,
} from "@/lib/api/rentals";
import { serializeContract } from "@/app/(protected)/alquileres/_components/serialize";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const contract = await getContractOrThrow(id);
  return ok(serializeContract(contract), "Contrato obtenido correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const contract = await prisma.rentalContract.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!contract) throw new AppError(404, "Contrato no encontrado");

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" || body.title === null) data.title = body.title?.trim() || null;
  if ("notes" in body) data.notes = body.notes?.trim() || null;
  if (typeof body.gracePeriodDays === "number" && body.gracePeriodDays >= 0) {
    data.gracePeriodDays = Math.floor(body.gracePeriodDays);
  }

  const updated = await prisma.rentalContract.update({
    where: { id },
    data,
    include: contractInclude,
  });
  return ok(updated, "Contrato actualizado correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const contract = await prisma.rentalContract.findUnique({
    where: { id },
    select: { id: true, createdByUserId: true },
  });
  if (!contract) throw new AppError(404, "Contrato no encontrado");
  assertCanDeleteContract(contract, auth);

  await prisma.rentalContract.delete({ where: { id } });
  return ok(null, "Contrato eliminado correctamente", path);
});
