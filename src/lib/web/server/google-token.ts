import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const CLOCK_SKEW_SECONDS = 60;

export type GoogleProfile = { sub: string; email: string; name: string | null; picture: string | null };

type Jwk = JsonWebKey & { kid?: string };
type Claims = {
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  nonce?: string;
};

let cache: { keys: Jwk[]; expires: number } | null = null;

async function loadKeys(url: string): Promise<Jwk[]> {
  if (cache && cache.expires > Date.now()) return cache.keys;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google certs ${response.status}`);
  const { keys } = (await response.json()) as { keys: Jwk[] };
  cache = { keys, expires: Date.now() + 60 * 60 * 1000 };
  return keys;
}

function decode<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

/** Valida firma y datos del token de "Sign in with Google". Devuelve null si algo no cierra. */
export async function verifyGoogleToken(
  token: string,
  options: { clientId: string; nonce: string; certsUrl?: string; now?: number },
): Promise<GoogleProfile | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = decode<{ alg?: string; kid?: string }>(parts[0]);
    if (header.alg !== "RS256" || !header.kid) return null;
    const keys = await loadKeys(options.certsUrl ?? CERTS_URL);
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    if (!verifier.verify(createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) return null;

    const claims = decode<Claims>(parts[1]);
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (!claims.iss || !ISSUERS.has(claims.iss)) return null;
    if (claims.aud !== options.clientId) return null;
    if (!claims.exp || claims.exp + CLOCK_SKEW_SECONDS < now) return null;
    if (!options.nonce || claims.nonce !== options.nonce) return null;
    if (!claims.sub || !claims.email) return null;
    if (claims.email_verified !== true && claims.email_verified !== "true") return null;
    return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name ?? null, picture: claims.picture ?? null };
  } catch {
    return null;
  }
}

export function resetGoogleCertsCache() {
  cache = null;
}
