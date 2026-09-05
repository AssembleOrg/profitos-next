import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, paginated } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { userId, isAdmin } = await getAuthContext();
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));

  const where = {
    ...(isAdmin ? {} : { OR: [{ userId }, { followUps: { some: { assignedToUserId: userId } } }] }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: { _count: { select: { visitas: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  return paginated(
    { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    "Clientes obtenidos correctamente",
    path
  );
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const { userId } = await getAuthContext();
  const body = await request.json();

  const { name, phone, email, notes } = body as Record<string, string | undefined>;
  const attachments = (body as { attachments?: unknown[] }).attachments;

  if (!name) throw new AppError(400, "El campo 'name' es obligatorio");

  const client = await prisma.client.create({
    data: {
      name,
      phone: phone ?? null,
      email: email ?? null,
      notes: notes ?? null,
      ...(Array.isArray(attachments) && { attachments: attachments as never }),
      userId,
    },
  });

  return created(client, "Cliente creado correctamente", path);
});
