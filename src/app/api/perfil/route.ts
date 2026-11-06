import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { parseContactPhones, readContactPhones } from "@/lib/auth/device-utils";

// Perfil propio.
//  GET → nombre, email, foto, teléfonos
//  PUT { phones: [{ label, number, whatsapp }] } → reemplaza los teléfonos

async function load(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true, avatarUrl: true, avatarCustom: true, contactPhones: true },
  });
  if (!u) throw new AppError(404, "Usuario no encontrado");
  return {
    fullName: u.fullName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    avatarCustom: u.avatarCustom,
    phones: readContactPhones(u.contactPhones),
  };
}

export type PerfilDTO = Awaited<ReturnType<typeof load>>;

export const GET = withHandler(async (request: NextRequest) => {
  const auth = await getAuthContext();
  return ok(await load(auth.userId), "Perfil", request.nextUrl.pathname);
});

export const PUT = withHandler(async (request: NextRequest) => {
  const auth = await getAuthContext();
  const body = (await request.json().catch(() => ({}))) as { phones?: unknown };
  const parsed = parseContactPhones(body.phones);
  if ("error" in parsed) throw new AppError(400, parsed.error);
  await prisma.user.update({
    where: { id: auth.userId },
    data: { contactPhones: parsed.phones as unknown as Prisma.InputJsonValue },
  });
  return ok(await load(auth.userId), "Teléfonos guardados", request.nextUrl.pathname);
});
