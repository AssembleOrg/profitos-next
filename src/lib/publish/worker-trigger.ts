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

/**
 * Pide al worker refrescar el cupo de créditos en vivo (GET gratis). Devuelve si
 * pudo. Espera hasta ~30s porque abre el navegador. Fail-soft.
 */
export async function triggerWorkerCreditsRefresh(): Promise<{ ok: boolean; error?: string }> {
  const base = process.env.WORKER_PUBLIC_URL?.trim();
  const secret = process.env.RELOGIN_SHARED_SECRET?.trim();
  if (!base || !secret) return { ok: false, error: "Worker no configurado (WORKER_PUBLIC_URL)" };
  try {
    const token = signReloginToken("credits", 60);
    const res = await fetch(`${base.replace(/\/+$/, "")}/credits/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}
