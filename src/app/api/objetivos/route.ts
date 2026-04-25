import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin, cardInclude } from "@/lib/api/objectives";
import { isCardStatus } from "@/lib/objectives";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const sp = request.nextUrl.searchParams;
  const assignedToUserId = sp.get("assignedToUserId")?.trim();
  const from = sp.get("from")?.trim();
  const to = sp.get("to")?.trim();

  const where: Record<string, unknown> = {};

  if (!auth.isAdmin) {
    where.assignedToUserId = auth.userId;
  } else if (assignedToUserId) {
    where.assignedToUserId = assignedToUserId;
  }

  // Period overlap: card.endDate >= from AND card.startDate <= to
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    where.endDate = { gte: fromDate };
  }
  if (toDate && !Number.isNaN(toDate.getTime())) {
    where.startDate = { lte: toDate };
  }

  const [items, total] = await Promise.all([
    prisma.objectiveCard.findMany({
      where,
      include: cardInclude,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: paginationToSkip(page, limit),
      take: limit,
    }),
    prisma.objectiveCard.count({ where }),
  ]);

  const result = buildPaginatedResult(items, total, page, limit);
  return paginated(result, "Objetivos obtenidos correctamente", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);

  const body = await request.json();
  const {
    assignedToUserIds,
    title,
    description,
    startDate,
    endDate,
    statusOverride,
    items,
  } = body as {
    assignedToUserIds?: string[];
    title?: string;
    description?: string | null;
    startDate?: string;
    endDate?: string;
    statusOverride?: string | null;
    items?: Array<{ text: string }>;
  };

  if (!Array.isArray(assignedToUserIds) || assignedToUserIds.length === 0) {
    throw new AppError(400, "Debe seleccionar al menos un empleado");
  }
  if (!title || !title.trim()) {
    throw new AppError(400, "El título es obligatorio");
  }
  if (!startDate || !endDate) {
    throw new AppError(400, "Las fechas de inicio y fin son obligatorias");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError(400, "Fechas inválidas");
  }
  if (start > end) {
    throw new AppError(400, "La fecha de inicio no puede ser posterior a la de fin");
  }

  const cleanItems = (items ?? [])
    .map((item) => ({ text: (item.text ?? "").trim() }))
    .filter((item) => item.text.length > 0);

  if (statusOverride && !isCardStatus(statusOverride)) {
    throw new AppError(400, "Estado inválido");
  }

  const users = await prisma.user.findMany({
    where: { id: { in: assignedToUserIds } },
    select: { id: true },
  });
  const validIds = new Set(users.map((u) => u.id));
  const missing = assignedToUserIds.filter((id) => !validIds.has(id));
  if (missing.length > 0) {
    throw new AppError(404, "Algún empleado seleccionado no existe");
  }

  const createdCards = await prisma.$transaction(
    assignedToUserIds.map((userId) =>
      prisma.objectiveCard.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          startDate: start,
          endDate: end,
          statusOverride: statusOverride || null,
          assignedToUserId: userId,
          createdByUserId: auth.userId,
          items: {
            create: cleanItems.map((item, index) => ({
              text: item.text,
              position: index,
            })),
          },
        },
        include: cardInclude,
      }),
    ),
  );

  return created(createdCards, "Objetivos creados correctamente", path);
});
