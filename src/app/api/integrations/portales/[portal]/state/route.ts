import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { changePublicationState, STATE_ACTIONS, type StateAction } from "@/lib/publish/state";

// Cambia el estado de una publicación YA existente en un portal.
// Body: { propertyId, action: "pause" | "close" | "activate" }
// La lógica vive en lib/publish/state.ts (compartida con las tools del chat).
export const POST = withHandler(async (request: NextRequest, context) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const { portal } = (await context!.params) as { portal: string };
  const body = (await request.json().catch(() => ({}))) as { propertyId?: string; action?: string };

  if (!body.propertyId) throw new AppError(400, "Falta propertyId");
  const action = body.action as StateAction;
  if (!STATE_ACTIONS.includes(action)) throw new AppError(400, `Acción inválida: ${body.action}`);

  const { result, message } = await changePublicationState(body.propertyId, portal, action);
  return ok(result, message, path);
});
