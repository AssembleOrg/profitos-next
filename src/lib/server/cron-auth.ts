import { AppError } from "@/lib/api/handler";

type HeaderReader = Pick<Headers, "get">;

export function assertCronAuthorized(headers: HeaderReader, secret: string | undefined, querySecret?: string | null) {
  const authHeader = headers.get("authorization");
  const headerSecret = headers.get("x-cron-secret");

  if (!secret) {
    throw new AppError(401, "CRON_SECRET no configurado");
  }

  const bearerOk = authHeader === `Bearer ${secret}`;
  const headerOk = headerSecret === secret;
  const queryOk = querySecret === secret;

  if (!bearerOk && !headerOk && !queryOk) {
    throw new AppError(401, "No autorizado para ejecutar cron");
  }
}
