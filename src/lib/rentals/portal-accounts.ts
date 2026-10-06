import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cuentas del portal de inquilinos (Supabase Auth, email + contraseña). El
 * staff habilita el acceso y define la contraseña inicial; no se mandan emails.
 */

const BAN_FOREVER = "876000h";

export async function enableTenantPortal(tenantId: string, password: string) {
  if (typeof password !== "string" || password.length < 8) {
    throw new AppError(400, "La contraseña tiene que tener al menos 8 caracteres");
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, email: true, fullName: true, authUserId: true },
  });
  if (!tenant) throw new AppError(404, "Inquilino no encontrado");
  if (!tenant.email) throw new AppError(400, "Cargale un email al inquilino para darle acceso");

  const admin = supabaseAdmin().auth.admin;
  let authUserId = tenant.authUserId;
  if (authUserId) {
    const { error } = await admin.updateUserById(authUserId, {
      email: tenant.email,
      password,
      ban_duration: "none",
      app_metadata: { kind: "tenant", tenantId: tenant.id },
    });
    if (error) throw new AppError(400, `No se pudo actualizar el acceso: ${error.message}`);
  } else {
    const { data, error } = await admin.createUser({
      email: tenant.email,
      password,
      email_confirm: true,
      app_metadata: { kind: "tenant", tenantId: tenant.id },
      user_metadata: { full_name: tenant.fullName },
    });
    if (error || !data.user) {
      const taken = /already|registered|exists/i.test(error?.message ?? "");
      throw new AppError(
        taken ? 409 : 400,
        taken
          ? "Ese email ya tiene una cuenta (puede ser del staff). Usá otro email para el inquilino."
          : `No se pudo crear el acceso: ${error?.message ?? "error desconocido"}`,
      );
    }
    authUserId = data.user.id;
  }

  return prisma.tenant.update({
    where: { id: tenant.id },
    data: { authUserId, portalEnabled: true, portalInvitedAt: new Date() },
    select: { id: true, portalEnabled: true, portalInvitedAt: true, authUserId: true },
  });
}

export async function disableTenantPortal(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, authUserId: true } });
  if (!tenant) throw new AppError(404, "Inquilino no encontrado");
  if (tenant.authUserId) {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(tenant.authUserId, { ban_duration: BAN_FOREVER });
    if (error) throw new AppError(400, `No se pudo bloquear el acceso: ${error.message}`);
  }
  return prisma.tenant.update({
    where: { id: tenant.id },
    data: { portalEnabled: false },
    select: { id: true, portalEnabled: true },
  });
}
