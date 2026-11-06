import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { deleteAvatarFile, uploadAvatar } from "@/lib/photos/avatar";

// Foto de perfil propia.
//  POST multipart `file` → sube, recorta cuadrada y la deja como foto
//  DELETE                → vuelve a la foto de Google (o ninguna)

const MAX_FILE = 15 * 1024 * 1024;

export const POST = withHandler(async (request: NextRequest) => {
  const auth = await getAuthContext();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) throw new AppError(400, "No llegó ninguna imagen");
  if (file.size > MAX_FILE) throw new AppError(400, "La imagen supera 15 MB");
  if (!/^image\//.test(file.type)) throw new AppError(400, "El archivo no es una imagen");

  let url: string;
  try {
    url = await uploadAvatar(auth.userId, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : "No se pudo procesar la imagen");
  }

  const prev = await prisma.user.findUnique({ where: { id: auth.userId }, select: { avatarUrl: true, avatarCustom: true } });
  await prisma.user.update({ where: { id: auth.userId }, data: { avatarUrl: url, avatarCustom: true } });
  if (prev?.avatarCustom) await deleteAvatarFile(prev.avatarUrl);

  return ok({ avatarUrl: url, avatarCustom: true }, "Foto actualizada", request.nextUrl.pathname);
});

export const DELETE = withHandler(async (request: NextRequest) => {
  const auth = await getAuthContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const googleAvatar = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

  const prev = await prisma.user.findUnique({ where: { id: auth.userId }, select: { avatarUrl: true, avatarCustom: true } });
  await prisma.user.update({ where: { id: auth.userId }, data: { avatarUrl: googleAvatar, avatarCustom: false } });
  if (prev?.avatarCustom) await deleteAvatarFile(prev.avatarUrl);

  return ok({ avatarUrl: googleAvatar, avatarCustom: false }, "Foto quitada", request.nextUrl.pathname);
});
