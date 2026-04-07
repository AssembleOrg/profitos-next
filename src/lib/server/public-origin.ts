type HeaderReader = Pick<Headers, "get">;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolvePublicOrigin(headers: HeaderReader): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL;
  if (explicit && explicit.trim()) {
    return normalizeBaseUrl(explicit.trim());
  }

  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }

  const host = headers.get("host");
  if (host) {
    const proto = process.env.NODE_ENV === "development" ? "http" : "https";
    return `${proto}://${host}`;
  }

  const origin = headers.get("origin");
  if (origin) return normalizeBaseUrl(origin);

  return "http://localhost:3000";
}
