import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import type { AppUser } from "@/lib/domain/types";
import { resolveRoleFromEmail } from "@/lib/auth/roles";

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const appUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!appUser) return null;

  const expectedRole = resolveRoleFromEmail(user.email ?? appUser.email);
  if (appUser.role !== expectedRole) {
    const updated = await prisma.user.update({
      where: { id: appUser.id },
      data: { role: expectedRole },
    });
    return updated as AppUser;
  }

  return appUser as AppUser;
});
