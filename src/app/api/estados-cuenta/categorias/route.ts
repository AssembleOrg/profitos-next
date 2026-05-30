import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { isEntryType } from "@/lib/account";

/**
 * Lista las categorías de ingreso/egreso.
 * Query: ?kind=income|expense, ?includeArchived=true
 */
export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind");
  const includeArchived = sp.get("includeArchived") === "true";

  const categories = await prisma.accountCategory.findMany({
    where: {
      ...(kind && isEntryType(kind) ? { kind } : {}),
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return ok(categories, "Categorías obtenidas correctamente", path);
});

/**
 * Crea una categoría. La pueden crear todos los usuarios.
 * Body: { name, kind: 'income'|'expense', color? }
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const body = await request.json();
  const { name, kind, color } = body as { name?: string; kind?: string; color?: string };

  if (!name?.trim()) throw new AppError(400, "El nombre es obligatorio");
  if (!isEntryType(kind)) throw new AppError(400, "Tipo de categoría inválido (income/expense)");

  const duplicate = await prisma.accountCategory.findFirst({
    where: { kind, name: { equals: name.trim(), mode: "insensitive" } },
  });
  if (duplicate) throw new AppError(409, "Ya existe una categoría con ese nombre");

  const last = await prisma.accountCategory.findFirst({
    where: { kind },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const category = await prisma.accountCategory.create({
    data: {
      name: name.trim(),
      kind,
      color: color?.trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return created(category, "Categoría creada correctamente", path);
});
