import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/api/followups";

export const GET = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      contracts: {
        include: {
          property: { select: { id: true, address: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!tenant) throw new AppError(404, "Inquilino no encontrado");
  return ok(tenant, "Inquilino obtenido correctamente", path);
});

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
  if (!tenant) throw new AppError(404, "Inquilino no encontrado");

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.fullName === "string") {
    if (!body.fullName.trim()) throw new AppError(400, "El nombre no puede estar vacío");
    data.fullName = body.fullName.trim();
  }
  if (typeof body.idType === "string") {
    if (body.idType !== "dni" && body.idType !== "cuit") {
      throw new AppError(400, "Tipo de documento inválido");
    }
    data.idType = body.idType;
  }
  if (typeof body.idNumber === "string") {
    if (!body.idNumber.trim()) throw new AppError(400, "El número de documento no puede estar vacío");
    data.idNumber = body.idNumber.trim();
  }
  if ("phone" in body) data.phone = body.phone?.trim() || null;
  if ("email" in body) data.email = body.email?.trim() || null;
  if ("notes" in body) data.notes = body.notes?.trim() || null;

  const updated = await prisma.tenant.update({ where: { id }, data });
  return ok(updated, "Inquilino actualizado correctamente", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);
  const { id } = await context!.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, _count: { select: { contracts: true } } },
  });
  if (!tenant) throw new AppError(404, "Inquilino no encontrado");
  if (tenant._count.contracts > 0) {
    throw new AppError(400, "No se puede eliminar: el inquilino tiene contratos asociados");
  }

  await prisma.tenant.delete({ where: { id } });
  return ok(null, "Inquilino eliminado correctamente", path);
});
