import { prisma } from "@/lib/prisma/client";
import type { AppUser } from "@/lib/domain/types";

interface UpsertUserParams {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  googleAccessToken?: string | null;
  googleRefreshToken?: string | null;
}

export async function upsertUser(params: UpsertUserParams): Promise<AppUser> {
  const user = await prisma.user.upsert({
    where: { id: params.id },
    update: {
      email: params.email,
      fullName: params.fullName ?? undefined,
      avatarUrl: params.avatarUrl ?? undefined,
      ...(params.googleAccessToken !== undefined && {
        googleAccessToken: params.googleAccessToken,
      }),
      ...(params.googleRefreshToken !== undefined && {
        googleRefreshToken: params.googleRefreshToken,
      }),
    },
    create: {
      id: params.id,
      email: params.email,
      fullName: params.fullName ?? null,
      avatarUrl: params.avatarUrl ?? null,
      role: "user",
      googleAccessToken: params.googleAccessToken ?? null,
      googleRefreshToken: params.googleRefreshToken ?? null,
    },
  });

  return user as AppUser;
}
