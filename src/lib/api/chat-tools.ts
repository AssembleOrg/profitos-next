import type { NextRequest } from "next/server";
import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import { resolveRoleFromEmail } from "@/lib/auth/roles";

/**
 * Auth de las tools del chat IA (rag-webchat). El bot llama estos endpoints
 * server-to-server con un secreto compartido en el header `x-tools-token`
 * (configurado en la definición de la tool, resuelto por env en rag-webchat).
 */
export function assertChatToolsAuth(request: NextRequest): void {
  const secret = process.env.CHAT_TOOLS_SECRET?.trim();
  if (!secret) throw new AppError(503, "Chat IA no configurado (falta CHAT_TOOLS_SECRET)");
  const got = request.headers.get("x-tools-token")?.trim();
  if (got !== secret) throw new AppError(401, "Token de tools inválido");
}

export type ChatRequester = {
  email: string;
  userId: string | null;
  fullName: string | null;
  isAdmin: boolean;
};

/**
 * Quién le habla al bot. rag-webchat manda en `x-user-identifier` el
 * userIdentifier de la sesión del widget (= email del usuario logueado en
 * Profitos, ver layout.tsx). Viene del servidor del chat, no del modelo, así
 * que sirve para permisos (admin / "sólo lo mío"). Null si es anónimo.
 */
export async function getChatRequester(request: NextRequest): Promise<ChatRequester | null> {
  const raw = request.headers.get("x-user-identifier")?.trim().toLowerCase() ?? "";
  if (!raw || raw.startsWith("anon_") || !raw.includes("@")) return null;
  const user = await prisma.user.findFirst({
    where: { email: { equals: raw, mode: "insensitive" } },
    select: { id: true, email: true, fullName: true, role: true },
  });
  const role = user?.role === "admin" || user?.role === "user" || user?.role === "viewer" ? user.role : resolveRoleFromEmail(raw);
  return {
    email: user?.email ?? raw,
    userId: user?.id ?? null,
    fullName: user?.fullName ?? null,
    isAdmin: role === "admin",
  };
}

/** Igual que getChatRequester pero exige usuario identificado y con cuenta. */
export async function requireChatRequester(request: NextRequest): Promise<ChatRequester & { userId: string }> {
  const r = await getChatRequester(request);
  if (!r?.userId) {
    throw new AppError(401, "No pude identificar al usuario que hace el pedido (abrí el chat desde Profitos con tu cuenta).");
  }
  return r as ChatRequester & { userId: string };
}

/** URL pública de la web (para devolver links a PDFs/fichas). */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://profitos-next-production.up.railway.app").replace(/\/+$/, "");
}
