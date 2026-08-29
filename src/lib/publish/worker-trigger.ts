import { signReloginToken } from "@/lib/scraper/relogin-token";

/**
 * Despierta al worker para que procese la cola de publicaciones YA (sin esperar
 * al tick). Fail-soft: si el worker no está configurado o no responde, no pasa
 * nada — el próximo tick del worker toma los jobs pending igual.
 */
export async function triggerWorkerProcess(): Promise<void> {
  const base = process.env.WORKER_PUBLIC_URL?.trim();
  const secret = process.env.RELOGIN_SHARED_SECRET?.trim();
  if (!base || !secret) return; // sin config → lo procesa el tick
  try {
    const token = signReloginToken("process", 60);
    await fetch(`${base.replace(/\/+$/, "")}/process`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* worker caído/ocupado: el tick lo procesa */
  }
}
