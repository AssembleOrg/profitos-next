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
import { parseContractConditions } from "@/lib/rentals/contract-input";
import { createContractDueDates } from "@/lib/rentals/due-generation";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const contract = await getContractOrThrow(id);
  return ok(serializeContract(contract), "Contrato obtenido correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const contract = await prisma.rentalContract.findUnique({
    where: { id },
    select: { id: true, managed: true },
  });
  if (!contract) throw new AppError(404, "Contrato no encontrado");

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" || body.title === null) data.title = body.title?.trim() || null;
  if ("notes" in body) data.notes = body.notes?.trim() || null;
  if (typeof body.gracePeriodDays === "number" && body.gracePeriodDays >= 0) {
    data.gracePeriodDays = Math.floor(body.gracePeriodDays);
  }
  const conditions = parseContractConditions(body as Record<string, unknown>);
  if (conditions.ownerId) {
    const owner = await prisma.owner.findUnique({ where: { id: conditions.ownerId }, select: { id: true } });
    if (!owner) throw new AppError(404, "El propietario no existe");
  }
  Object.assign(data, conditions);
  if ("attachments" in body && Array.isArray(body.attachments)) data.attachments = body.attachments;

  // ¿Cambia quién administra? Sin cuotas cobradas se puede pasar a "lo
  // administra el propietario" (se borran las cuotas pendientes); al volver a
  // "lo administra la inmobiliaria" se generan las cuotas del contrato.
  const nextManaged = typeof body.managed === "boolean" ? body.managed : contract.managed;
  const updated = await prisma.$transaction(async (tx) => {
    if (contract.managed && !nextManaged) {
      const [conCobros, recibos] = await Promise.all([
        tx.rentalDueDate.count({ where: { contractId: id, OR: [{ transactions: { some: {} } }, { status: { not: null } }] } }),
        tx.rentalReceipt.count({ where: { contractId: id } }),
      ]);
      if (conCobros > 0 || recibos > 0) {
        throw new AppError(409, "Este contrato ya tiene cobros o recibos registrados: no se puede pasar a \"lo administra el propietario\".");
      }
      await tx.rentalDueDate.deleteMany({ where: { contractId: id } });
    }
    if (!contract.managed && nextManaged) {
      const existentes = await tx.rentalDueDate.count({ where: { contractId: id } });
      if (existentes === 0) await createContractDueDates(tx, id, auth.userId, "al pasar a administración de la inmobiliaria");
    }
    return tx.rentalContract.update({
      where: { id },
      data: { ...data, managed: nextManaged },
      include: contractInclude,
    });
  }, { timeout: 20000 });
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
