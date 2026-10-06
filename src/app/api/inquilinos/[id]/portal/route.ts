import type { NextRequest } from "next/server";
import { withHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import { disableTenantPortal, enableTenantPortal } from "@/lib/rentals/portal-accounts";

/** Habilita el portal (o cambia la contraseña). Body: { password } */
export const POST = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;
  const body = (await request.json()) as { password?: string };
  const tenant = await enableTenantPortal(id, body.password ?? "");
  return ok(tenant, "Acceso al portal habilitado", path);
});

export const DELETE = withHandler(async (request: NextRequest, context) => {
  const path = request.nextUrl.pathname;
  await getAuthContext();
  const { id } = await context!.params;
  const tenant = await disableTenantPortal(id);
  return ok(tenant, "Acceso al portal desactivado", path);
});
