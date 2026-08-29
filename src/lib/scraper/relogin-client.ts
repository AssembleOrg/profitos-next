/**
 * Cliente liviano (usable desde rutas Next) para hablar con el servidor de
 * re-login del worker. NO importa Playwright: sólo hace fetch al worker.
 */
import { signReloginToken } from "@/lib/scraper/relogin-token";

export const RELOGIN_PORTALS = ["zonaprop", "argenprop", "argenprop-gestion"] as const;
export type ReloginPortal = (typeof RELOGIN_PORTALS)[number];

export function isReloginPortal(p: string): p is ReloginPortal {
  return (RELOGIN_PORTALS as readonly string[]).includes(p);
}

function workerBase(): string {
  const url = process.env.WORKER_PUBLIC_URL?.trim();
  if (!url) throw new Error("Falta WORKER_PUBLIC_URL (URL pública del worker de Railway)");
  return url.replace(/\/+$/, "");
}

async function callWorker<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${workerBase()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(data?.message ?? `Worker devolvió ${res.status}`);
  return data;
}

export type StartRemoteLogin = { sessionId: string; portal: string; ttlMs: number; token: string; viewUrl: string };

/** Arranca el login remoto en el worker y arma la URL del visor noVNC. */
export async function startRemoteLogin(portal: ReloginPortal): Promise<StartRemoteLogin> {
  const token = signReloginToken(portal);
  const r = await callWorker<{ sessionId: string; portal: string; ttlMs: number }>("/relogin/start", { token });
  const viewUrl = `${workerBase()}/relogin/view?token=${encodeURIComponent(token)}`;
  return { ...r, token, viewUrl };
}

export async function finishRemoteLogin(
  portal: ReloginPortal,
  sessionId: string
): Promise<{ ok: boolean; loggedIn: boolean; message: string }> {
  const token = signReloginToken(portal);
  return callWorker("/relogin/finish", { token, sessionId });
}

export async function cancelRemoteLogin(portal: ReloginPortal): Promise<{ ok: boolean }> {
  const token = signReloginToken(portal);
  return callWorker("/relogin/cancel", { token });
}
