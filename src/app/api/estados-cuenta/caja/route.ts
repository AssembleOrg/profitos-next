import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { getCashOverview } from "@/lib/account/cash-server";

/** Caja y pendientes. Banco, personas y retiros: solo admin. */
export const GET = withHandler(async (request: NextRequest) => {
  const auth = await getAuthContext();
  const overview = await getCashOverview({ isAdmin: auth.isAdmin });
  return ok(overview, "Caja obtenida correctamente", request.nextUrl.pathname);
});
