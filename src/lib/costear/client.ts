// ────────────────────────────────────────────────────────────────────
// Cliente de la API de Costear (backend NestJS externo).
// Cada usuario habilitado (mapa email→teléfono en COSTEAR_USERS) lee/crea
// SUS propios gastos personales de Costear dentro de profitos, sin duplicar
// datos (cada gasto vive en un solo lugar).
//
// Auth M2M: POST /bot/token con header X-Bot-Secret + { phone } devuelve
// un JWT del usuario dueño de ese teléfono (Bearer, TTL ~30d). Se cachea en
// memoria POR TELÉFONO y se refresca al expirar o ante un 401.
//
// Lectura en vivo: no se persiste nada en la DB de profitos.
// Acceso restringido a los emails con teléfono mapeado (ver getCostearPhoneForEmail).
// ────────────────────────────────────────────────────────────────────

import { randomUUID } from "node:crypto";

// Envelope estándar de respuestas de Costear (ResponseInterceptor).
interface CostearEnvelope<T> {
  ok?: boolean;
  status?: number;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface BotTokenData {
  accessToken: string;
  tokenType: string;
  expiresInSec: number;
  user: {
    id: string;
    accountId: string;
    email: string;
    displayName: string | null;
    tier: string;
  };
}

export interface CostearExpense {
  id: string;
  accountId: string;
  categoryId: string | null;
  title: string | null;
  merchant: string | null;
  /** Monto en unidades menores (centavos). */
  amountMinor: number;
  /** Código de 3 letras, ej "ARS". */
  currency: string;
  spentAt: string;
  paymentMethod: string | null;
  notes: string | null;
  source: string | null;
  extractionId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CostearSummary {
  spentMinor: number;
  count: number;
  byCategory: Array<{ categoryId: string | null; spentMinor: number; count: number }>;
}

export interface ExpenseFilters {
  /** ISO date "YYYY-MM-DD" inclusive. */
  from?: string;
  /** ISO date "YYYY-MM-DD" inclusive. */
  to?: string;
  /** Búsqueda en título/comercio/notas. */
  text?: string;
  /** Código de moneda de 3 letras. */
  currency?: string;
}

// Cache de tokens en memoria del proceso, POR TELÉFONO (cada usuario de
// Costear tiene su propio JWT). Sobrevive entre requests.
const g = globalThis as {
  _costearTokens?: Map<string, { value: string; expiresAt: number }>;
};
function tokenCache(): Map<string, { value: string; expiresAt: number }> {
  g._costearTokens ??= new Map();
  return g._costearTokens;
}

// Refrescar el token un poco antes de que expire de verdad.
const TOKEN_SKEW_MS = 60 * 1000;
const PAGE_LIMIT = 100;
const MAX_PAGES = 20; // techo defensivo: hasta 2000 gastos por consulta.

function getBaseConfig() {
  const base = process.env.COSTEAR_API_URL;
  const secret = process.env.COSTEAR_BOT_SECRET;
  if (!base) throw new Error("Falta COSTEAR_API_URL en variables de entorno");
  if (!secret) throw new Error("Falta COSTEAR_BOT_SECRET en variables de entorno");
  return { base: base.replace(/\/+$/, ""), secret };
}

/**
 * Registro de usuarios de Costear: mapa email→teléfono. Cada usuario de
 * profitos con entrada acá ve/crea SUS propios gastos de Costear.
 *
 * Fuentes de env (se combinan):
 *  - COSTEAR_USERS: "email:telefono,email:telefono" (coma o punto y coma).
 *  - Legacy: COSTEAR_OWNER_EMAIL + COSTEAR_USER_PHONE (una sola entrada).
 */
function getCostearUsers(): Map<string, string> {
  const map = new Map<string, string>();

  const raw = process.env.COSTEAR_USERS?.trim();
  if (raw) {
    for (const entry of raw.split(/[,;\n]/)) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf(":");
      if (idx < 0) continue;
      const email = trimmed.slice(0, idx).trim().toLowerCase();
      const phone = trimmed.slice(idx + 1).trim();
      if (email && phone) map.set(email, phone);
    }
  }

  // Compatibilidad con la config vieja de un solo usuario.
  const legacyEmail = process.env.COSTEAR_OWNER_EMAIL?.trim().toLowerCase();
  const legacyPhone = process.env.COSTEAR_USER_PHONE?.trim();
  if (legacyEmail && legacyPhone && !map.has(legacyEmail)) {
    map.set(legacyEmail, legacyPhone);
  }

  return map;
}

/** Teléfono de Costear para un email de profitos, o null si no está habilitado. */
export function getCostearPhoneForEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return getCostearUsers().get(email.trim().toLowerCase()) ?? null;
}

async function mintToken(phone: string): Promise<string> {
  const { base, secret } = getBaseConfig();
  const res = await fetch(`${base}/bot/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bot-Secret": secret,
    },
    body: JSON.stringify({ phone }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Costear /bot/token error ${res.status}: ${text.slice(0, 300)}`);
  }
  const body = (await res.json()) as CostearEnvelope<BotTokenData>;
  const token = body.data?.accessToken;
  const ttl = body.data?.expiresInSec ?? 0;
  if (!token) throw new Error("Costear /bot/token no devolvió accessToken");
  tokenCache().set(phone, {
    value: token,
    expiresAt: Date.now() + Math.max(0, ttl * 1000 - TOKEN_SKEW_MS),
  });
  return token;
}

async function getToken(phone: string, forceRefresh = false): Promise<string> {
  const cached = tokenCache().get(phone);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;
  return mintToken(phone);
}

/** Ejecuta un fetch autenticado (para `phone`) con reintento único ante 401. */
async function authedFetch(phone: string, run: (token: string) => Promise<Response>): Promise<Response> {
  let token = await getToken(phone);
  let res = await run(token);
  if (res.status === 401) {
    token = await getToken(phone, true);
    res = await run(token);
  }
  return res;
}

/** GET autenticado a Costear con reintento único ante 401 (token vencido). */
async function costearGet<T>(phone: string, path: string, params: URLSearchParams): Promise<CostearEnvelope<T>> {
  const { base } = getBaseConfig();
  const url = `${base}${path}?${params.toString()}`;

  const res = await authedFetch(phone, (token) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Costear GET ${path} error ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as CostearEnvelope<T>;
}

function baseParams(filters: ExpenseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("dateFrom", `${filters.from}T00:00:00.000Z`);
  if (filters.to) params.set("dateTo", `${filters.to}T23:59:59.999Z`);
  if (filters.text?.trim()) params.set("text", filters.text.trim());
  if (filters.currency) params.set("currency", filters.currency);
  return params;
}

/** Trae TODOS los gastos del rango (del usuario `phone`), paginando internamente. */
export async function fetchCostearExpenses(phone: string, filters: ExpenseFilters): Promise<CostearExpense[]> {
  const items: CostearExpense[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = baseParams(filters);
    params.set("page", String(page));
    params.set("limit", String(PAGE_LIMIT));
    params.set("sort", "spentAt:desc");

    const body = await costearGet<CostearExpense[]>(phone, "/expenses", params);
    const pageItems = Array.isArray(body.data) ? body.data : [];
    items.push(...pageItems);

    const totalPages = body.pagination?.totalPages ?? 1;
    if (page >= totalPages || pageItems.length < PAGE_LIMIT) break;
  }
  return items;
}

/** Resumen agregado (total gastado, cantidad, por categoría) del usuario `phone`. */
export async function fetchCostearSummary(phone: string, filters: ExpenseFilters): Promise<CostearSummary> {
  const params = baseParams(filters);
  // El summary no pagina.
  params.delete("text");
  const body = await costearGet<CostearSummary>(phone, "/expenses/summary", params);
  return body.data ?? { spentMinor: 0, count: 0, byCategory: [] };
}

export interface CreateCostearExpenseInput {
  title: string;
  /** Monto en unidades menores (centavos). */
  amountMinor: number;
  /** Código de 3 letras, ej "ARS". */
  currency: string;
  /** ISO date-time. */
  spentAt: string;
  merchant?: string | null;
  notes?: string | null;
  /** Si viene de una extracción de IA: la consume, setea source y adjunta el archivo. */
  extractionId?: string | null;
}

/** Crea un gasto personal en Costear (POST /expenses, requiere Idempotency-Key). */
export async function createCostearExpense(phone: string, input: CreateCostearExpenseInput): Promise<CostearExpense> {
  const { base } = getBaseConfig();

  const res = await authedFetch(phone, (token) =>
    fetch(`${base}/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        title: input.title,
        amountMinor: input.amountMinor,
        currency: input.currency,
        spentAt: input.spentAt,
        merchant: input.merchant ?? undefined,
        notes: input.notes ?? undefined,
        extractionId: input.extractionId ?? undefined,
      }),
      cache: "no-store",
    })
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Costear POST /expenses error ${res.status}: ${text.slice(0, 300)}`);
  }
  const body = (await res.json()) as CostearEnvelope<CostearExpense>;
  return body.data;
}

// ── Extracción con IA (foto de ticket / audio / texto → borrador de gasto) ──

export interface ProposedExpense {
  title: string;
  merchant?: string;
  amountMinor: number;
  currency: string;
  spentAt: string;
  /** Etiqueta de categoría sugerida (NO un id). */
  categoryGuess?: string;
  items?: Array<{ description: string; quantity?: number; unitAmountMinor?: number; amountMinor: number }>;
}

export interface CostearExtraction {
  id: string;
  type: "PHOTO" | "AUDIO" | "TEXT";
  status: "PROCESSING" | "READY" | "FAILED" | "CONSUMED" | "DISCARDED";
  transcript: string | null;
  proposed: ProposedExpense | null;
  error: string | null;
}

async function createExtractionFile(
  phone: string,
  kind: "photo" | "audio",
  file: Blob,
  filename: string
): Promise<CostearExtraction> {
  const { base } = getBaseConfig();
  const res = await authedFetch(phone, (token) => {
    const form = new FormData();
    form.append("file", file, filename);
    return fetch(`${base}/extractions/${kind}`, {
      method: "POST",
      // No seteamos Content-Type: FormData pone su boundary solo.
      headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": randomUUID() },
      body: form,
      cache: "no-store",
    });
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Costear /extractions/${kind} error ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json() as CostearEnvelope<CostearExtraction>).data;
}

async function createExtractionText(phone: string, text: string): Promise<CostearExtraction> {
  const { base } = getBaseConfig();
  const res = await authedFetch(phone, (token) =>
    fetch(`${base}/extractions/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({ text }),
      cache: "no-store",
    })
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Costear /extractions/text error ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json() as CostearEnvelope<CostearExtraction>).data;
}

async function waitExtraction(phone: string, id: string, timeoutMs = 25000): Promise<CostearExtraction> {
  const { base } = getBaseConfig();
  const res = await authedFetch(phone, (token) =>
    fetch(`${base}/extractions/${id}/wait?timeoutMs=${timeoutMs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Costear extraction wait error ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json() as CostearEnvelope<CostearExtraction>).data;
}

/**
 * Crea una extracción (foto/audio/texto) y espera hasta el estado terminal,
 * devolviendo el borrador `proposed` para que la dueña lo revise/edite.
 */
export async function extractCostear(
  phone: string,
  input: {
    kind: "photo" | "audio" | "text";
    file?: Blob;
    filename?: string;
    text?: string;
  }
): Promise<CostearExtraction> {
  let ext =
    input.kind === "text"
      ? await createExtractionText(phone, input.text ?? "")
      : await createExtractionFile(phone, input.kind, input.file!, input.filename ?? "upload");

  // El worker procesa en background: se hace long-poll hasta ~50s.
  for (let i = 0; i < 2 && ext.status === "PROCESSING"; i++) {
    ext = await waitExtraction(phone, ext.id);
  }
  return ext;
}

/**
 * ¿Este email tiene gastos de Costear habilitados en profitos? (tiene teléfono
 * mapeado). Solo esos usuarios ven/crean sus gastos personales de Costear.
 */
export function isCostearOwner(email: string | null | undefined): boolean {
  return getCostearPhoneForEmail(email) !== null;
}

/** ¿Está configurada la integración de Costear? (evita errores si faltan envs) */
export function isCostearConfigured(): boolean {
  return Boolean(
    process.env.COSTEAR_API_URL && process.env.COSTEAR_BOT_SECRET && getCostearUsers().size > 0
  );
}
