import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { contractInclude } from "@/lib/api/rentals";
import { generateDueDates, isRentalFrequency } from "@/lib/rentals";
import type { Prisma } from "@/generated/prisma/client";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const sp = request.nextUrl.searchParams;
  const propertyId = sp.get("propertyId")?.trim();
  const tenantId = sp.get("tenantId")?.trim();
  const q = sp.get("q")?.trim();

  const where: Prisma.RentalContractWhereInput = {};
  if (propertyId) where.propertyId = propertyId;
  if (tenantId) where.tenantId = tenantId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
      { tenant: { fullName: { contains: q, mode: "insensitive" } } },
      { tenant: { idNumber: { contains: q } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.rentalContract.findMany({
      where,
      include: contractInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: paginationToSkip(page, limit),
      take: limit,
    }),
    prisma.rentalContract.count({ where }),
  ]);

  return paginated(buildPaginatedResult(items, total, page, limit), "Contratos obtenidos correctamente", path);
});

interface AdditionalInput {
  additionalId: string;
  amount: number;
}

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const body = await request.json();
  const {
    propertyId,
    tenantId,
    title,
    startDate,
    endDate,
    frequency,
    baseAmount,
    currency,
    firstDueDate,
    gracePeriodDays,
    notes,
    additionals,
  } = body as {
    propertyId?: string;
    tenantId?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    frequency?: string;
    baseAmount?: number;
    currency?: string;
    firstDueDate?: string;
    gracePeriodDays?: number;
    notes?: string;
    additionals?: AdditionalInput[];
  };

  if (!propertyId) throw new AppError(400, "Falta la propiedad");
  if (!tenantId) throw new AppError(400, "Falta el inquilino");
  if (!startDate || !endDate || !firstDueDate) throw new AppError(400, "Faltan las fechas");
  if (!isRentalFrequency(frequency)) throw new AppError(400, "Frecuencia inválida");
  if (typeof baseAmount !== "number" || !Number.isFinite(baseAmount) || baseAmount < 0) {
    throw new AppError(400, "Monto base inválido");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const first = new Date(firstDueDate);
  if ([start, end, first].some((d) => Number.isNaN(d.getTime()))) {
    throw new AppError(400, "Fechas inválidas");
  }
  if (start > end) throw new AppError(400, "La fecha de inicio no puede ser posterior a la de fin");
  if (first < start || first > end) {
    throw new AppError(400, "El primer vencimiento debe estar dentro del rango del contrato");
  }

  const grace =
    typeof gracePeriodDays === "number" && Number.isFinite(gracePeriodDays) && gracePeriodDays >= 0
      ? Math.floor(gracePeriodDays)
      : 0;

  // Validar adicionales y leer datos existentes
  const cleanAdditionals = Array.isArray(additionals)
    ? additionals
        .map((a) => ({
          additionalId: typeof a.additionalId === "string" ? a.additionalId : "",
          amount: typeof a.amount === "number" && Number.isFinite(a.amount) ? a.amount : 0,
        }))
        .filter((a) => a.additionalId)
    : [];

  if (cleanAdditionals.length > 0) {
    const ids = cleanAdditionals.map((a) => a.additionalId);
    const existing = await prisma.rentalAdditional.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const existingSet = new Set(existing.map((e) => e.id));
    const missing = ids.filter((id) => !existingSet.has(id));
    if (missing.length > 0) throw new AppError(404, "Algún adicional no existe");
  }

  // Generar la lista de cuotas
  const generated = generateDueDates({
    startDate: start,
    endDate: end,
    firstDueDate: first,
    frequency,
    baseAmount,
  });
  if (generated.length === 0) throw new AppError(400, "No se generaron vencimientos. Revisá las fechas y frecuencia.");

  // Crear todo en una transacción
  const contract = await prisma.$transaction(async (tx) => {
    const created = await tx.rentalContract.create({
      data: {
        propertyId,
        tenantId,
        title: title?.trim() || null,
        startDate: start,
        endDate: end,
        frequency,
        baseAmount,
        currency: currency?.trim() || "ARS",
        firstDueDate: first,
        gracePeriodDays: grace,
        notes: notes?.trim() || null,
        createdByUserId: auth.userId,
        additionals: {
          create: cleanAdditionals.map((a, idx) => ({
            additionalId: a.additionalId,
            amount: a.amount,
            position: idx,
          })),
        },
      },
      include: { additionals: true },
    });

    // Calcular expectedAmount con adicionales
    const additionalsSum = created.additionals.reduce((acc, x) => acc + x.amount, 0);
    const totalExpected = baseAmount + additionalsSum;

    // Crear las cuotas + sus links a adicionales
    for (const due of generated) {
      const dueRow = await tx.rentalDueDate.create({
        data: {
          contractId: created.id,
          position: due.position,
          dueDate: new Date(due.dueDate),
          expectedAmount: totalExpected,
          additionals: {
            create: created.additionals.map((ca) => ({
              contractAdditionalId: ca.id,
              included: true,
            })),
          },
        },
      });

      await tx.rentalDueDateAction.create({
        data: {
          dueDateId: dueRow.id,
          type: "creation",
          description: `Cuota ${due.position} generada al crear el contrato`,
          createdByUserId: auth.userId,
        },
      });
    }

    return tx.rentalContract.findUnique({
      where: { id: created.id },
      include: contractInclude,
    });
  });

  return created(contract, "Contrato creado correctamente", path);
});
