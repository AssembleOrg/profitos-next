import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { voidReceipt } from "@/lib/rentals/collect";

export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  const auth = await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const receipt = await voidReceipt(id, body.reason ?? "", auth.userId);
  return ok(receipt, "Recibo anulado", path);
});
