import type { NextRequest } from "next/server";
import { AppError } from "@/lib/api/handler";

/**
 * Auth de las tools del chat IA (rag-webchat). El bot llama estos endpoints
 * server-to-server con un secreto compartido en el header `x-tools-token`
 * (configurado en la definición de la tool, resuelto por env en rag-webchat).
 * No hay sesión de usuario: son endpoints de lectura + objetivos.
 */
export function assertChatToolsAuth(request: NextRequest): void {
  const secret = process.env.CHAT_TOOLS_SECRET?.trim();
  if (!secret) throw new AppError(503, "Chat IA no configurado (falta CHAT_TOOLS_SECRET)");
  const got = request.headers.get("x-tools-token")?.trim();
  if (got !== secret) throw new AppError(401, "Token de tools inválido");
}
