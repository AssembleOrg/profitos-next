import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma/client";
import type { AppUser } from "@/lib/domain/types";

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  // TEMP_VISUAL_QA: bypass local de sesión para revisión visual del rediseño.
  if (process.env.VISUAL_QA_USER_ID) {
    const qaUser = await prisma.user.findUnique({
      where: { id: process.env.VISUAL_QA_USER_ID },
    });
    if (qaUser) {
      return {
        ...qaUser,
        navFavorites: Array.isArray(qaUser.navFavorites)
          ? (qaUser.navFavorites as string[])
          : null,
      } as AppUser;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const appUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!appUser) return null;

  return {
    ...appUser,
    navFavorites: Array.isArray(appUser.navFavorites)
      ? (appUser.navFavorites as string[])
      : null,
  } as AppUser;
});
