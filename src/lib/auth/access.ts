import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { isAdminEmail } from "@/lib/auth/roles";
import { computeAccessibleHrefs } from "@/lib/nav/views";

export interface CurrentAccess {
  isAdmin: boolean;
  /** Hrefs que el usuario puede ver/abrir. */
  accessibleHrefs: string[];
}

/**
 * Acceso del usuario autenticado: admin (todo) o las vistas concedidas en su
 * entrada de whitelist (+ las siempre permitidas). Devuelve null si no hay sesión.
 */
export async function getCurrentAccess(): Promise<CurrentAccess | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin" || isAdminEmail(user.email);

  let allowedViews: string[] | null = null;
  if (!isAdmin) {
    const entry = await prisma.whitelist.findUnique({
      where: { email: user.email.toLowerCase() },
      select: { allowedViews: true },
    });
    allowedViews = Array.isArray(entry?.allowedViews) ? (entry.allowedViews as string[]) : null;
  }

  return {
    isAdmin,
    accessibleHrefs: [...computeAccessibleHrefs(isAdmin, allowedViews)],
  };
}
