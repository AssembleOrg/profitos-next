import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { getAuthContext } from "@/lib/api/auth";

export const PATCH = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();

  const { id } = await context!.params;
  const existing = await prisma.recentContact.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Contacto no encontrado");

  const body = await request.json();
  const { name, email, phone, cellphone, leadStatus } = body as Record<string, string | undefined>;

  const contact = await prisma.recentContact.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(cellphone !== undefined && { cellphone: cellphone || null }),
      ...(leadStatus !== undefined && { leadStatus: leadStatus || null }),
    },
  });

  return ok(contact, "Contacto actualizado correctamente", path);
});
