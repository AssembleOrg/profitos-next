/**
 * Cliente server-only de la API "partner" de Buscala (informes de personas).
 * La API key es un secreto que NUNCA llega al browser: todas las llamadas pasan
 * por rutas server de Profitos que usan este cliente. El cupo/precio los maneja
 * Buscala; acá sólo consultamos.
 */
import "server-only";

export interface BuscalaSource {
  sourceKey: string;
  status: "pending" | "running" | "human_required" | "ok" | "failed";
  summary?: string | null;
  data?: unknown;
  updatedAt?: string;
}

export interface BuscalaReport {
  id: string;
  identifier: string;
  kind: "cuit" | "dni";
  label: string | null;
  createdAt: string;
  sources: BuscalaSource[];
}

export interface BuscalaSourceInfo {
  key: string;
  name: string;
  org?: string | null;
}

const TIMEOUT_MS = 20_000;

function config(): { base: string; key: string } {
  const base = process.env.BUSCALA_API_URL;
  const key = process.env.BUSCALA_API_KEY;
  if (!base) throw new Error("Falta BUSCALA_API_URL en el entorno.");
  if (!key) throw new Error("Falta BUSCALA_API_KEY en el entorno.");
  return { base: base.replace(/\/+$/, ""), key };
}

/** true si la integración con Buscala está configurada (para esconder la sección si no). */
export function isBuscalaConfigured(): boolean {
  return !!process.env.BUSCALA_API_URL && !!process.env.BUSCALA_API_KEY;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const { base, key } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = body?.error ?? `Buscala respondió ${res.status}`;
      throw new BuscalaError(res.status, msg);
    }
    return body?.data as T;
  } catch (err) {
    if (err instanceof BuscalaError) throw err;
    if (err instanceof Error && err.name === "AbortError") throw new BuscalaError(504, "Buscala tardó demasiado en responder.");
    throw new BuscalaError(502, "No se pudo conectar con Buscala.");
  } finally {
    clearTimeout(timer);
  }
}

/** Inicia un informe. `identifier` = CUIT/CUIL o DNI. */
export function startReport(identifier: string): Promise<BuscalaReport> {
  return call<BuscalaReport>("/api/partner/reports", { method: "POST", body: JSON.stringify({ identifier }) });
}

/** Trae el estado/resultado de un informe ya iniciado. */
export function getReport(id: string): Promise<BuscalaReport> {
  return call<BuscalaReport>(`/api/partner/reports/${encodeURIComponent(id)}`, { method: "GET" });
}

/** Catálogo público de fuentes (para mostrar nombres lindos). No requiere la key. */
export async function getSources(): Promise<BuscalaSourceInfo[]> {
  const { base } = config();
  try {
    const res = await fetch(`${base}/api/sources`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = await res.json().catch(() => null);
    return (body?.data ?? []) as BuscalaSourceInfo[];
  } catch {
    return [];
  }
}

export class BuscalaError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "BuscalaError";
  }
}
