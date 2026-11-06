/**
 * Utilidades puras de sesiones por dispositivo y teléfonos de contacto
 * (sin Prisma ni Next: se pueden probar sueltas).
 */

/** Nombre corto del dispositivo a partir del User-Agent: "iPhone · Safari". */
export function deviceLabel(userAgent?: string | null): string {
  const ua = userAgent || "";
  if (!ua) return "Dispositivo desconocido";

  let os = "Otro";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "Mac";
  else if (/CrOS/i.test(ua)) os = "Chromebook";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Navegador";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/CriOS|Chrome\//i.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return `${os} · ${browser}`;
}

export interface PlaceName {
  locality: string | null;
  area: string | null;
  region: string | null;
  country: string | null;
}

/**
 * Traduce la respuesta de Nominatim (reverse, jsonv2) a partido/localidad.
 * En el GBA el dato útil es el partido ("Partido de Quilmes" → "Quilmes");
 * en CABA, el barrio.
 */
export function placeFromNominatim(address: Record<string, unknown> | null | undefined): PlaceName {
  const a = address || {};
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const region = clean(a.state);
  const country = clean(a.country_code)?.toUpperCase() ?? null;

  if (region && /Ciudad Aut[oó]noma/i.test(region)) {
    return { area: "CABA", locality: clean(a.suburb) ?? clean(a.city_district), region: "CABA", country };
  }

  const stripPartido = (v: string | null) => (v ? v.replace(/^Partido de\s+/i, "").trim() : null);
  const district = clean(a.state_district);
  const area =
    stripPartido(district && /^Partido de/i.test(district) ? district : null) ??
    stripPartido(clean(a.county)) ??
    clean(a.city) ??
    clean(a.town);
  const locality = clean(a.town) ?? clean(a.city) ?? clean(a.village) ?? clean(a.suburb);

  return { area, locality, region, country };
}

export interface SessionClaims {
  sessionId: string | null;
  /** Momento del inicio de sesión (amr), en ms. */
  signedInAt: number | null;
}

/** Lee session_id y el momento del login del access token de Supabase (ya validado por getUser). */
export function claimsFromAccessToken(token: string | null | undefined): SessionClaims {
  const empty = { sessionId: null, signedInAt: null };
  if (!token) return empty;
  const part = token.split(".")[1];
  if (!part) return empty;
  try {
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      session_id?: unknown;
      amr?: { timestamp?: unknown }[];
    };
    const sessionId = typeof json.session_id === "string" && json.session_id ? json.session_id : null;
    const ts = Array.isArray(json.amr)
      ? json.amr.map((m) => (typeof m?.timestamp === "number" ? m.timestamp : 0)).reduce((a, b) => Math.max(a, b), 0)
      : 0;
    return { sessionId, signedInAt: ts > 0 ? ts * 1000 : null };
  } catch {
    return empty;
  }
}

/**
 * Una sesión que todavía no tiene fila (de antes de esta función, o recién
 * iniciada) vale salvo que se hayan cerrado las demás después de que empezó.
 */
export function unseenSessionAllowed(signedInAt: number | null, sessionsRevokedAt: Date | null | undefined): boolean {
  if (!sessionsRevokedAt) return true;
  if (!signedInAt) return false;
  return signedInAt >= sessionsRevokedAt.getTime();
}

/** IP del cliente detrás del proxy de Railway. */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || null;
}

// ─── Teléfonos de contacto ──────────────────────────────────────────

export interface ContactPhone {
  label: string;
  number: string;
  whatsapp: boolean;
}

export const MAX_PHONES = 5;

/**
 * Valida la lista que manda el formulario. El número se guarda tal cual lo
 * escribieron (solo se recortan espacios de los bordes): no se "corrige".
 * Devuelve el error del primer teléfono inválido.
 */
export function parseContactPhones(raw: unknown): { phones: ContactPhone[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Formato de teléfonos inválido" };
  const phones: ContactPhone[] = [];
  for (const [i, item] of raw.entries()) {
    const r = (item ?? {}) as Record<string, unknown>;
    const number = typeof r.number === "string" ? r.number.trim().replace(/\s+/g, " ") : "";
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 40) : "";
    if (!number && !label) continue; // fila vacía
    if (!/^\+?[\d\s()-]+$/.test(number)) return { error: `Teléfono ${i + 1}: usá solo números, espacios, guiones o +` };
    const digits = number.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return { error: `Teléfono ${i + 1}: tiene que tener entre 8 y 15 números` };
    phones.push({ label, number, whatsapp: r.whatsapp === true });
  }
  if (phones.length > MAX_PHONES) return { error: `Máximo ${MAX_PHONES} teléfonos` };
  return { phones };
}

/** Normaliza el JSON guardado en jp_users.contact_phones. */
export function readContactPhones(raw: unknown): ContactPhone[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && typeof (p as { number?: unknown }).number === "string")
    .map((p) => ({ label: typeof p.label === "string" ? p.label : "", number: p.number as string, whatsapp: p.whatsapp === true }));
}

/**
 * Link de WhatsApp solo si el número es inequívoco: con +código de país, o un
 * celular argentino de 10 números (área + número) o con 54 adelante.
 */
export function whatsappLink(number: string): string | null {
  const trimmed = number.trim();
  let d = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return d.length >= 10 ? `https://wa.me/${d}` : null;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) return `https://wa.me/549${d}`;
  if (d.length === 12 && d.startsWith("54")) return `https://wa.me/549${d.slice(2)}`;
  if (d.length === 13 && d.startsWith("549")) return `https://wa.me/${d}`;
  return null;
}
