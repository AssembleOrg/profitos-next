"use client";

import { useSearchParams } from "next/navigation";
import { useLoginAnimation } from "./use-login-animation";
import { LoginV4 } from "./login-v4";
import { AUTH_ERRORS } from "@/lib/domain/types";

function mapUrlError(error: string | null): string | undefined {
  if (error === "not_whitelisted") return AUTH_ERRORS.NOT_WHITELISTED;
  if (error === "auth_failed") return AUTH_ERRORS.OAUTH_ERROR;
  return undefined;
}

export function LoginShell() {
  const step = useLoginAnimation();
  const searchParams = useSearchParams();
  const urlError = mapUrlError(searchParams.get("error"));

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <LoginV4 step={step} urlError={urlError} />
    </div>
  );
}
