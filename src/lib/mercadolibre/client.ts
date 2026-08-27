// Cliente HTTP para la API de MercadoLibre con Bearer token + auto-refresh.
import { ML } from "./config";
import { getValidAccessToken } from "./oauth";

export class MlApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "MlApiError";
    this.status = status;
    this.body = body;
  }
}

interface MlFetchOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  // Endpoints públicos (categorías, atributos) no necesitan token.
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
}

export async function mlFetch<T = unknown>(path: string, opts: MlFetchOpts = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = opts;

  const url = new URL(path.startsWith("http") ? path : `${ML.apiBase}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) headers["authorization"] = `Bearer ${await getValidAccessToken()}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (data as { message?: string })?.message ??
      (data as { error?: string })?.error ??
      `MercadoLibre HTTP ${res.status}`;
    throw new MlApiError(res.status, message, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
