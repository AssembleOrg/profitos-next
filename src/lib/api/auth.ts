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
  // TEMP_VISUAL_QA: bypass local de sesión para revisión visual del rediseño.
  if (process.env.VISUAL_QA_USER_ID) {
    const qa = await prisma.user.findUnique({
      where: { id: process.env.VISUAL_QA_USER_ID },
      select: { id: true, role: true, email: true },
    });
    if (qa) {
      const qaRole = normalizeRole(qa.role, qa.email);
      return { userId: qa.id, email: qa.email, role: qaRole, isAdmin: qaRole === "admin" };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AppError(401, "No autenticado");

  const appUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, email: true },
  });

  const email = appUser?.email ?? user.email ?? "";
  const role = normalizeRole(appUser?.role, email);

  return {
    userId: user.id,
    email,
    role,
    isAdmin: role === "admin",
  };
}
