/**
 * Publicar / despublicar un aviso de ArgenProp = asignarle PUNTOS.
 *
 * Relevado del paso "Publicar" de Gestión (/avisos/editar/{id}/publicar), que
 * monta el componente <puntos-v2-ap> de components.sosiva451.com con dos tokens
 * de la sesión (AuthenticationToken y TokenCRM). El componente hace:
 *   GET  https://api.sosiva451.com/Avisos/Search/GestionArgenprop/{idAviso}
 *        → IdOrigen_t, Visible_b, Puntos_i
 *   PUT  https://integradores.api.sosiva451.com/v1/Puntos/{IdOrigen}/Componente/Puntos/{puntos}
 *        headers: Authorization: Bearer {AuthenticationToken}, X-Token-CRM: {TokenCRM}
 * Los avisos activos de la cuenta usan 1 punto (destaque "Normal"); los puntos
 * salen del abono de la inmobiliaria.
 *
 * api.sosiva451.com está detrás de CloudFront y bloquea IPs de datacenter: sale
 * por el mismo proxy residencial que Gestión.
 */
import { gestionGetHtml, proxyFetchRetry } from "./gestion";

const API = "https://api.sosiva451.com";
const API_INTEGRADORES = "https://integradores.api.sosiva451.com/v1";

/** Puntos por defecto: lo que usan los avisos publicados de la cuenta. */
export const AP_DEFAULT_POINTS = 1;

type Tokens = { auth: string; crm: string };

async function tokensFor(idAviso: string): Promise<Tokens> {
  const html = await gestionGetHtml(`/avisos/editar/${encodeURIComponent(idAviso)}/publicar`);
  const auth = (html.match(/AuthenticationToken="([^"]+)"/) ?? [])[1];
  const crm = (html.match(/TokenCRM="([^"]+)"/) ?? [])[1];
  if (!auth || !crm) throw new Error(`ArgenProp: no encontré los tokens de publicación del aviso ${idAviso}.`);
  return { auth, crm };
}

function headers(t: Tokens): Record<string, string> {
  return {
    authorization: `Bearer ${t.auth}`,
    "x-token-crm": t.crm,
    accept: "application/json",
    origin: "https://gestion.argenprop.com",
    referer: "https://gestion.argenprop.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  };
}

export interface ApAvisoState {
  idOrigen: string;
  visible: boolean;
  puntos: number;
}

async function avisoState(idAviso: string, t: Tokens): Promise<ApAvisoState> {
  const res = await proxyFetchRetry(`${API}/Avisos/Search/GestionArgenprop/${encodeURIComponent(idAviso)}`, {
    method: "GET",
    headers: headers(t),
  });
  if (res.status >= 400) throw new Error(`ArgenProp: no pude leer el aviso ${idAviso} (HTTP ${res.status}).`);
  const body = (await res.json()) as { Results?: Array<{ IdOrigen_t?: string; Visible_b?: boolean; Puntos_i?: number }> };
  const a = body.Results?.[0];
  if (!a?.IdOrigen_t) throw new Error(`ArgenProp: el aviso ${idAviso} no aparece en la búsqueda de Gestión.`);
  return { idOrigen: a.IdOrigen_t, visible: Boolean(a.Visible_b), puntos: a.Puntos_i ?? 0 };
}

/** Estado actual (visible / puntos) del aviso en ArgenProp. */
export async function getApAvisoState(idAviso: string): Promise<ApAvisoState> {
  return avisoState(idAviso, await tokensFor(idAviso));
}

/**
 * Publica el aviso asignándole `puntos`. Devuelve el estado posterior; si
 * ArgenProp no lo deja visible, tira error con el detalle.
 */
export async function publishWithPoints(idAviso: string, puntos = AP_DEFAULT_POINTS): Promise<ApAvisoState> {
  const t = await tokensFor(idAviso);
  const before = await avisoState(idAviso, t);
  if (before.visible && before.puntos >= puntos) return before;

  // Asignar puntos es idempotente (fija el valor): se puede reintentar por otra IP.
  const res = await proxyFetchRetry(
    `${API_INTEGRADORES}/Puntos/${encodeURIComponent(before.idOrigen)}/Componente/Puntos/${puntos}`,
    { method: "PUT", headers: headers(t) }
  );
  if (res.status >= 400) {
    const text = await res.text().catch(() => "");
    throw new Error(`ArgenProp rechazó la publicación del aviso ${idAviso} (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  // El buscador de Gestión tarda unos segundos en reflejarlo.
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const after = await avisoState(idAviso, t);
    if (after.visible) return after;
  }
  throw new Error(`ArgenProp aceptó los puntos pero el aviso ${idAviso} sigue sin estar visible. Revisalo en Gestión.`);
}
