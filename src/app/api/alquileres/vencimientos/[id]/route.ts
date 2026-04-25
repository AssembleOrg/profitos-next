import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { dueDateInclude, getDueDateOrThrow, recomputeDueExpectedAmount } from "@/lib/api/rentals";
import { isManualDueStatus } from "@/lib/rentals";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const due = await getDueDateOrThrow(id);
  return ok(due, "Vencimiento obtenido correctamente", path);
});

interface AdditionalPatch {
  contractAdditionalId: string;
  included?: boolean;
  amountOverride?: number | null;
}

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;

  const due = await prisma.rentalDueDate.findUnique({
    where: { id },
    select: { id: true, status: true, contract: { select: { id: true } } },
  });
  if (!due) throw new AppError(404, "Vencimiento no encontrado");

  const body = await request.json();
  const auditActions: Array<{
    type: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    description?: string | null;
  }> = [];

  // 1) Status (manual override)
  if ("status" in body) {
    const next = body.status;
    if (next === null || next === "") {
      if (due.status !== null) {
        await prisma.rentalDueDate.update({ where: { id }, data: { status: null } });
        auditActions.push({
          type: "status_change",
          fromStatus: due.status,
          toStatus: null,
          description: typeof body.statusNote === "string" ? body.statusNote.trim() : null,
        });
      }
    } else if (typeof next === "string" && isManualDueStatus(next)) {
      if (due.status !== next) {
        await prisma.rentalDueDate.update({ where: { id }, data: { status: next } });
        auditActions.push({
          type: "status_change",
          fromStatus: due.status,
          toStatus: next,
          description: typeof body.statusNote === "string" ? body.statusNote.trim() : null,
        });
      }
    } else {
      throw new AppError(400, "Estado inválido");
    }
  }

  // 2) Notes
  if ("notes" in body) {
    await prisma.rentalDueDate.update({
      where: { id },
      data: { notes: body.notes?.trim() || null },
    });
  }

  // 3) Toggle / override de adicionales
  if (Array.isArray(body.additionals)) {
    const patches = body.additionals as AdditionalPatch[];
    for (const p of patches) {
      if (typeof p.contractAdditionalId !== "string") continue;
      const update: Record<string, unknown> = {};
      if (typeof p.included === "boolean") update.included = p.included;
      if ("amountOverride" in p) {
        update.amountOverride =
          typeof p.amountOverride === "number" && Number.isFinite(p.amountOverride)
            ? p.amountOverride
            : null;
      }
      if (Object.keys(update).length === 0) continue;
      await prisma.rentalDueDateAdditional.updateMany({
        where: { dueDateId: id, contractAdditionalId: p.contractAdditionalId },
        data: update,
      });
    }
    await recomputeDueExpectedAmount(id);
  }

  // Crear acciones de auditoría
  for (const a of auditActions) {
    await prisma.rentalDueDateAction.create({
      data: {
        dueDateId: id,
        type: a.type,
        fromStatus: a.fromStatus ?? null,
        toStatus: a.toStatus ?? null,
        description: a.description ?? null,
        createdByUserId: auth.userId,
      },
    });
  }

  const updated = await prisma.rentalDueDate.findUnique({
    where: { id },
    include: dueDateInclude,
  });
  return ok(updated, "Vencimiento actualizado correctamente", path);
});
