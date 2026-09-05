import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { parsePagination, buildPaginatedResult, paginationToSkip } from "@/lib/api/pagination";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/api/followups";
import { findClientByContact } from "@/lib/clients/match";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { page, limit } = parsePagination(request.nextUrl.searchParams);
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status")?.trim();
  const propertyId = sp.get("propertyId")?.trim();
  const assignedToUserId = sp.get("assignedToUserId")?.trim();
  const q = sp.get("q")?.trim();

  const where: Record<string, unknown> = {};

  if (!auth.isAdmin) {
    where.assignedToUserId = auth.userId;
  } else if (assignedToUserId) {
    where.assignedToUserId = assignedToUserId;
  }

  if (status) where.status = status;
  if (propertyId) where.propertyId = propertyId;

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { property: { address: { contains: q, mode: "insensitive" } } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { phone: { contains: q } } },
      { assignedToUser: { fullName: { contains: q, mode: "insensitive" } } },
      { assignedToUser: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.propertyFollowUp.findMany({
      where,
      include: {
        property: {
          select: { id: true, address: true, city: true, zone: true },
        },
        assignedToUser: {
          select: { id: true, email: true, fullName: true },
        },
        client: { select: { id: true, name: true, phone: true, email: true } },
        _count: {
          select: { actions: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: paginationToSkip(page, limit),
      take: limit,
    }),
    prisma.propertyFollowUp.count({ where }),
  ]);

  const result = buildPaginatedResult(items, total, page, limit);
  return paginated(result, "Seguimientos obtenidos correctamente", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);

  const body = await request.json();
  const {
    propertyId,
    assignedToUserId,
    title,
    notes,
    status,
    dueDate,
    newClient,
  } = body as {
    propertyId?: string;
    assignedToUserId?: string;
    title?: string;
    notes?: string;
    status?: string;
    dueDate?: string;
    clientId?: string | null;
    newClient?: { name?: string; phone?: string; email?: string } | null;
  };
  let clientId = (body as { clientId?: string | null }).clientId ?? null;

  if (!propertyId) throw new AppError(400, "El campo 'propertyId' es obligatorio");
  if (!assignedToUserId) throw new AppError(400, "El campo 'assignedToUserId' es obligatorio");

  // Cliente nuevo inline: reusa uno existente si coincide tel/email (mismo dedup que "tomar").
  if (!clientId && newClient?.name?.trim()) {
    const dup = await findClientByContact(newClient.email, newClient.phone);
    if (dup) {
      clientId = dup.id;
    } else {
      const c = await prisma.client.create({
        data: {
          name: newClient.name.trim(),
          phone: newClient.phone?.trim() || null,
          email: newClient.email?.trim() || null,
          userId: assignedToUserId,
        },
        select: { id: true },
      });
      clientId = c.id;
    }
  }
  if (clientId) {
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!c) throw new AppError(404, "Cliente no encontrado");
  }

  const [property, assignedUser] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true } }),
  ]);

  if (!property) throw new AppError(404, "Propiedad no encontrada");
  if (!assignedUser) throw new AppError(404, "Usuario asignado no encontrado");

  const followUp = await prisma.propertyFollowUp.create({
    data: {
      propertyId,
      assignedToUserId,
      assignedByUserId: auth.userId,
      clientId,
      title: title ?? null,
      notes: notes ?? null,
      status: status ?? "pendiente",
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: {
      property: {
        select: { id: true, address: true, city: true, zone: true },
      },
      assignedToUser: {
        select: { id: true, email: true, fullName: true },
      },
      client: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  return created(followUp, "Seguimiento creado correctamente", path);
});
