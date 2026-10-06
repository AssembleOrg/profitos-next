import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";

/**
 * Sesión del portal de inquilinos. La cuenta es un usuario de Supabase Auth
 * (email + contraseña) creado por el staff, con `app_metadata.kind = "tenant"`
 * y vinculado a `jp_tenants.auth_user_id`. Solo cuenta si el portal está
 * habilitado para ese inquilino.
 */
export interface PortalTenant {
  id: string;
  fullName: string;
  email: string | null;
  authUserId: string;
}

export const getCurrentTenant = cache(async (): Promise<PortalTenant | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.kind !== "tenant") return null;

  const tenant = await prisma.tenant.findUnique({
    where: { authUserId: user.id },
    select: { id: true, fullName: true, email: true, authUserId: true, portalEnabled: true },
  });
  if (!tenant || !tenant.portalEnabled || !tenant.authUserId) return null;
  return { id: tenant.id, fullName: tenant.fullName, email: tenant.email, authUserId: tenant.authUserId };
});

/** Para APIs del portal: 401 sin sesión de inquilino habilitada. */
export async function requireTenant(): Promise<PortalTenant> {
  const tenant = await getCurrentTenant();
  if (!tenant) throw new AppError(401, "Iniciá sesión para continuar");
  return tenant;
}
