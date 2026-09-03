import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { applyContactAction, CONTACT_ACTIONS, type ContactAction } from "@/lib/messages/contact-actions";

/**
 * Acciones sobre un contacto de la central de mensajes.
 * Body: { messageId: "portal:rowId", action: "take" | "wait" | "transfer" | "restore", toUserId? }
 * La lógica vive en lib/messages/contact-actions.ts (compartida con el chat IA).
 */
export const POST = withHandler(async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const body = (await request.json().catch(() => ({}))) as {
    messageId?: string;
    action?: string;
    toUserId?: string;
  };
  const messageId = (body.messageId ?? "").trim();
  if (!messageId.includes(":")) throw new AppError(400, "messageId inválido");
  if (!(CONTACT_ACTIONS as readonly string[]).includes(body.action ?? "")) throw new AppError(400, "Acción inválida");

  const { data, message } = await applyContactAction(
    { messageId, action: body.action as ContactAction, toUserId: body.toUserId },
    { userId: auth.userId, isAdmin: auth.isAdmin }
  );
  return ok(data, message, path);
});
