import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/api/followups";

export const GET = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();

  const items = await prisma.rentalAdditional.findMany({
    orderBy: [{ name: "asc" }],
  });
  return ok(items, "Adicionales obtenidos correctamente", path);
});

export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  assertAdmin(auth);

  const body = await request.json();
  const {
    name,
    defaultAmount,
    notes,
  } = body as { name?: string; defaultAmount?: number | null; notes?: string };

  if (!name?.trim()) throw new AppError(400, "El nombre es obligatorio");

  const additional = await prisma.rentalAdditional.create({
    data: {
      name: name.trim(),
      defaultAmount:
        typeof defaultAmount === "number" && Number.isFinite(defaultAmount)
          ? defaultAmount
          : null,
      notes: notes?.trim() || null,
    },
  });

  return created(additional, "Adicional creado correctamente", path);
});
