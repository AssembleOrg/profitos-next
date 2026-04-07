import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { AppError } from "@/lib/api/handler";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const status = request.nextUrl.searchParams.get("status")?.trim().toLowerCase();
  const q = request.nextUrl.searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (!auth.isAdmin) where.assignedToUserId = auth.userId;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { recentContact: { name: { contains: q, mode: "insensitive" } } },
      { recentContact: { email: { contains: q, mode: "insensitive" } } },
      { recentContact: { phone: { contains: q, mode: "insensitive" } } },
      { recentContact: { cellphone: { contains: q, mode: "insensitive" } } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contactFollowUp.findMany({
      where,
      include: {
        recentContact: true,
        assignedToUser: { select: { id: true, email: true, fullName: true } },
        assignedByUser: { select: { id: true, email: true, fullName: true } },
        _count: { select: { actions: true, statusChanges: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: paginationToSkip(page, limit),
      take: limit,
    }),
    prisma.contactFollowUp.count({ where }),
  ]);

  const result = buildPaginatedResult(items, total, page, limit);
  return paginated(result, "Seguimientos de consultas obtenidos", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const body = await request.json();
  const recentContactId = String(body?.recentContactId ?? "").trim();
  const status = String(body?.status ?? "pendiente").trim().toLowerCase();
  const notes = String(body?.notes ?? "").trim() || null;
  const assignedToUserId = String(body?.assignedToUserId ?? "").trim() || null;

  if (!recentContactId) {
    throw new AppError(400, "recentContactId es obligatorio");
  }

  const followUp = await prisma.contactFollowUp.create({
    data: {
      recentContactId,
      status,
      notes,
      assignedToUserId,
      assignedByUserId: auth.userId,
    },
    include: {
      recentContact: true,
      assignedToUser: { select: { id: true, email: true, fullName: true } },
      assignedByUser: { select: { id: true, email: true, fullName: true } },
    },
  });

  await prisma.contactFollowUpStatusChange.create({
    data: {
      followUpId: followUp.id,
      fromStatus: null,
      toStatus: status,
      note: "Estado inicial definido manualmente",
      changedByUserId: auth.userId,
    },
  });

  return created(followUp, "Seguimiento de consulta creado", path);
});
