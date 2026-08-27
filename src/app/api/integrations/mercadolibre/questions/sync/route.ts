import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { searchReceivedQuestions } from "@/lib/mercadolibre/items";
import { upsertPortalQuestion } from "@/lib/mercadolibre/questions";

// Trae las preguntas recibidas desde ML y las persiste (backfill manual).
export const POST = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const path = request.nextUrl.pathname;
  const status = (request.nextUrl.searchParams.get("status") as "UNANSWERED" | "ANSWERED" | "ALL") ?? "UNANSWERED";

  const questions = await searchReceivedQuestions(status === "ANSWERED" || status === "ALL" ? status : "UNANSWERED");
  let saved = 0;
  for (const q of questions) {
    await upsertPortalQuestion(q);
    saved++;
  }
  return ok({ saved }, `Sincronizadas ${saved} preguntas`, path);
});
