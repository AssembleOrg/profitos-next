import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { resolveRoleFromEmail } from "@/lib/auth/roles";

export interface AuthContext {
  userId: string;
  email: string;
  role: "admin" | "user" | "viewer";
  isAdmin: boolean;
}

function normalizeRole(role: string | null | undefined, fallbackEmail: string | undefined): AuthContext["role"] {
  if (role === "admin" || role === "user" || role === "viewer") return role;
  return resolveRoleFromEmail(fallbackEmail ?? "");
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AppError(401, "No autenticado");
  // Los inquilinos tienen cuenta Supabase (portal) pero no son staff.
  if (user.app_metadata?.kind === "tenant") throw new AppError(403, "Sin acceso");

  const appUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  });
  // Staff = fila en jp_users (la crea el callback de Google para emails de la
  // whitelist). Una sesión válida sin esa fila no es staff.
  if (!appUser) throw new AppError(403, "Sin acceso");

  const email = appUser?.email ?? user.email ?? "";
  const role = normalizeRole(appUser?.role, email);

  return {
    userId: user.id,
    email,
    role,
    isAdmin: role === "admin",
  };
}
