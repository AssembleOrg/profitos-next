// OAuth 2.0 (authorization_code + PKCE) para MercadoLibre.
// access_token dura 6h; refresh_token es de un solo uso (se rota en cada refresh).
// ML exige PKCE (code_challenge S256 en el authorize, code_verifier en el token).
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma/client";
import { ML, ML_PORTAL, assertMlConfigured } from "./config";

// Margen para refrescar antes de que venza (5 min).
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Genera el par PKCE. El verifier se guarda (cookie) y se manda al canjear el code.
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32)); // 43 chars
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthUrl(state: string, codeChallenge: string): string {
  assertMlConfigured();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ML.clientId,
    redirect_uri: ML.redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${ML.authBase}/authorization?${params.toString()}`;
}

interface MlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // segundos (21600 = 6h)
  scope?: string;
  user_id: number;
  refresh_token: string;
}

async function requestToken(body: Record<string, string>): Promise<MlTokenResponse> {
  const res = await fetch(`${ML.apiBase}/oauth/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { message?: string; error?: string })?.message ??
      (data as { error?: string })?.error ??
      `HTTP ${res.status}`;
    throw new Error(`MercadoLibre OAuth error: ${msg}`);
  }
  return data as MlTokenResponse;
}

async function persistToken(tok: MlTokenResponse, opts: { connected?: boolean } = {}) {
  const expiresAt = new Date(Date.now() + tok.expires_in * 1000);
  const base = {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt,
    externalUser: String(tok.user_id),
    scope: tok.scope ?? null,
  };
  await prisma.portalToken.upsert({
    where: { portal: ML_PORTAL },
    create: {
      portal: ML_PORTAL,
      ...base,
      connectedAt: opts.connected ? new Date() : null,
    },
    update: {
      ...base,
      ...(opts.connected ? { connectedAt: new Date() } : {}),
    },
  });
  return expiresAt;
}

// Canjea el `code` del callback por tokens y los guarda (conexión inicial).
export async function exchangeCode(code: string, codeVerifier: string): Promise<void> {
  assertMlConfigured();
  const tok = await requestToken({
    grant_type: "authorization_code",
    client_id: ML.clientId,
    client_secret: ML.clientSecret,
    code,
    redirect_uri: ML.redirectUri,
    code_verifier: codeVerifier,
  });
  await persistToken(tok, { connected: true });
}

// Devuelve un access_token válido, refrescándolo si está por vencer.
export async function getValidAccessToken(): Promise<string> {
  assertMlConfigured();
  const row = await prisma.portalToken.findUnique({ where: { portal: ML_PORTAL } });
  if (!row?.refreshToken) {
    throw new Error("MercadoLibre no está conectado. Conectá la cuenta primero.");
  }
  const stillValid =
    row.accessToken && row.expiresAt && row.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;
  if (stillValid) return row.accessToken as string;

  const tok = await requestToken({
    grant_type: "refresh_token",
    client_id: ML.clientId,
    client_secret: ML.clientSecret,
    refresh_token: row.refreshToken,
  });
  await persistToken(tok);
  return tok.access_token;
}

export interface MlConnectionStatus {
  connected: boolean;
  nickname: string | null;
  externalUser: string | null;
  expiresAt: string | null;
  configured: boolean;
}

export async function getConnectionStatus(): Promise<MlConnectionStatus> {
  const configured = Boolean(ML.clientId && ML.clientSecret);
  const row = await prisma.portalToken.findUnique({ where: { portal: ML_PORTAL } });
  return {
    connected: Boolean(row?.refreshToken),
    nickname: row?.nickname ?? null,
    externalUser: row?.externalUser ?? null,
    expiresAt: row?.expiresAt?.toISOString() ?? null,
    configured,
  };
}
