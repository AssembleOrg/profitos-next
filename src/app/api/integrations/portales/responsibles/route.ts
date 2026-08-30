import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getResponsibles } from "@/lib/publish/responsibles";

// Lista de responsables de ZonaProp (cacheada; la refresca el worker al publicar).
export const GET = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const responsibles = await getResponsibles("zonaprop");
  return ok({ responsibles }, "Responsables", request.nextUrl.pathname);
});
