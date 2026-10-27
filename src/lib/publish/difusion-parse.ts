/**
 * Panel de Difusión — parte pura (sin prisma): cómo se leen los avisos de cada
 * portal y cómo se cuentan. La usan el worker (al sincronizar) y la web.
 *
 * Relevado oct 2026:
 *  - ZonaProp: GET /avisos-api/panel/api/v2/postings (listado, con estado y plan)
 *    + GET /avisos-api/panel/api/v1/performance/getpostingquality?postingId=N
 *    → { percentage_correctness, quality_status, validations: [{ rule_id, status, message }] }.
 *    rule_id vistos: duplicate, deployment (emprendimiento publicado como
 *    clasificado), rented_or_sold, pictures_quality, housing_feature,
 *    location_quality, price. Con duplicate/deployment el panel de ZP muestra el
 *    aviso como penalizado (calidad 0, queda último en el listado).
 *  - ArgenProp Gestión: listados server-rendered por estado; no informa calidad
 *    ni problemas por aviso (sus "Alertas" son avisos a compradores).
 */

/** error: no sale o queda penalizado · warn: el portal lo marca para revisar · tip: sugerencia de calidad. */
export type IssueLevel = "error" | "warn" | "tip";
export type ListingIssue = { rule: string; level: IssueLevel; message: string };

export type ListingRow = {
  externalId: string;
  code: string | null;
  title: string | null;
  address: string | null;
  url: string | null;
  pictureUrl: string | null;
  status: string;
  published: boolean;
  plan: string | null;
  quality: number | null;
  issues: ListingIssue[];
};

// ─── ZonaProp ────────────────────────────────────────────────────────────────

export type ZpPosting = {
  postingId: number;
  title?: string | null;
  urlPosting?: string | null;
  internalCode?: string | null;
  postingLocation?: { address?: string | null; zone?: string | null; city?: string | null }[] | null;
  urlPicture?: string | null;
  stateAndDates?: { status?: string | null }[] | null;
  publicationPlan?: string | null;
};

export type ZpQuality = {
  percentage_correctness?: string | number | null;
  quality_status?: string | null;
  validations?: { rule_id?: string | null; status?: string | null; message?: string | null; advice?: string | null }[] | null;
};

/** Estados de ZP en los que el aviso se ve en el portal. */
export const ZP_PUBLISHED = new Set(["ONLINE", "NEAR_END"]);
/** Estados a los que vale la pena pedirles la calidad (WITHOUT_CREDIT: quiso salir y no pudo). */
export const ZP_QUALITY_STATES = new Set(["ONLINE", "NEAR_END", "WITHOUT_CREDIT"]);
/** Reglas de ZP que dejan el aviso penalizado / fuera de juego: cuentan como error. */
const ZP_BLOCKING_RULES = new Set(["duplicate", "deployment", "rented_or_sold"]);

const ZP_PLAN: Record<string, string> = { SIMPLE: "simple", HIGHLIGHTED: "destacado", SUPERHIGHLIGHTED: "superdestacado" };

export function zpStatus(p: ZpPosting): string {
  return (p.stateAndDates?.[0]?.status ?? "").toUpperCase() || "DESCONOCIDO";
}

export function parseZpPosting(p: ZpPosting, quality: ZpQuality | null): ListingRow {
  const status = zpStatus(p);
  const loc = p.postingLocation?.[0];
  const issues: ListingIssue[] = [];
  if (status === "WITHOUT_CREDIT") {
    issues.push({ rule: "without_credit", level: "error", message: "No se publicó: la cuenta no tiene cupo disponible para ese plan." });
  }
  if (status === "NEAR_END") {
    issues.push({ rule: "near_end", level: "warn", message: "El aviso está por vencer." });
  }
  for (const v of quality?.validations ?? []) {
    const rule = v.rule_id?.trim() || "quality";
    const message = (v.message || v.advice || "").trim();
    if (!message) continue;
    // ZP marca "error" cosas que no lo bajan (ej. precio debajo del promedio): alerta.
    const level: IssueLevel = ZP_BLOCKING_RULES.has(rule) ? "error" : v.status === "error" ? "warn" : "tip";
    issues.push({ rule, level, message });
  }
  const pct = quality?.percentage_correctness;
  const q = pct === null || pct === undefined || pct === "" ? null : Number.parseInt(String(pct), 10);
  // "not_apply": ZP todavía no lo evalúa (aviso nuevo) → sin calidad, no es un 0.
  const qualityValue = quality?.quality_status === "not_apply" || !Number.isFinite(q) ? null : q;
  return {
    externalId: String(p.postingId),
    code: p.internalCode?.trim() || null,
    title: p.title?.trim() || null,
    address: [loc?.address, loc?.zone].filter((x) => x && x.trim()).join(", ").replace(/\s+/g, " ") || null,
    url: p.urlPosting ? `https://www.zonaprop.com.ar/propiedades/${p.urlPosting}` : null,
    pictureUrl: p.urlPicture || null,
    status,
    published: ZP_PUBLISHED.has(status),
    plan: ZP_PLAN[(p.publicationPlan ?? "").toUpperCase()] ?? (p.publicationPlan ? p.publicationPlan.toLowerCase() : null),
    quality: qualityValue,
    issues,
  };
}

// ─── ArgenProp ───────────────────────────────────────────────────────────────

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/**
 * Tarjetas de un listado de Gestión: `<a data-id-aviso="N" data-item-card ...>`
 * con la dirección (p.secure), el código (data-code-clipboard) y las fotos.
 */
export function parseApCards(html: string, status: string): ListingRow[] {
  const out: ListingRow[] = [];
  const starts = [...html.matchAll(/<a data-id-aviso="(\d{5,})" data-item-card/g)];
  for (let i = 0; i < starts.length; i++) {
    const id = starts[i][1];
    const chunk = html.slice(starts[i].index!, starts[i + 1]?.index ?? starts[i].index! + 20_000);
    const address = chunk.match(/<p class="secure">([^<]*)<\/p>/)?.[1];
    const code = chunk.match(/data-code-clipboard="([^"]*)"/)?.[1];
    const info = chunk.match(/<p class="card-info">([^<]*)<\/p>/)?.[1];
    const photos = Number(chunk.match(/<\/span>\/(\d+)\s*<\/div>/)?.[1] ?? (chunk.includes("data-photo-counter") ? NaN : 0));
    const picture = chunk.match(/<img data-src="([^"]+)"/)?.[1];
    const issues: ListingIssue[] = [];
    if (photos === 0) issues.push({ rule: "no_pictures", level: "warn", message: "El aviso no tiene fotos." });
    out.push({
      externalId: id,
      code: code ? decode(code) : null,
      title: info ? decode(info) : null,
      address: address ? decode(address) : null,
      url: `https://www.argenprop.com/aviso--${id}`,
      pictureUrl: picture ?? null,
      status,
      published: status === "VIGENTE" || status === "RESERVADO",
      plan: null,
      quality: null,
      issues,
    });
  }
  return out;
}

// ─── Resumen (las tarjetas del panel) ────────────────────────────────────────

export type PortalSummary = {
  publicadas: number;
  sinPublicar: number;
  porPlan: Record<string, number>;
  /** Con al menos un problema que lo deja afuera o penalizado. */
  errores: number;
  /** Publicadas que el portal marca para revisar (sin errores). */
  alertas: number;
  /** Publicadas con sugerencias de calidad del portal (sin errores ni alertas). */
  sugerencias: number;
  calidadPromedio: number | null;
};

type SummaryInput = Pick<ListingRow, "published" | "plan" | "quality" | "issues">;

export function hasError(l: Pick<ListingRow, "issues">): boolean {
  return l.issues.some((i) => i.level === "error");
}

export function hasAlert(l: Pick<ListingRow, "issues">): boolean {
  return l.issues.some((i) => i.level === "warn");
}

export function summarize(rows: SummaryInput[]): PortalSummary {
  const porPlan: Record<string, number> = {};
  let publicadas = 0;
  let errores = 0;
  let alertas = 0;
  let sugerencias = 0;
  let qSum = 0;
  let qN = 0;
  for (const r of rows) {
    if (r.published) {
      publicadas++;
      if (r.plan) porPlan[r.plan] = (porPlan[r.plan] ?? 0) + 1;
      if (r.quality !== null) {
        qSum += r.quality;
        qN++;
      }
    }
    if (hasError(r)) errores++;
    else if (r.published && hasAlert(r)) alertas++;
    else if (r.published && r.issues.length) sugerencias++;
  }
  return {
    publicadas,
    sinPublicar: rows.length - publicadas,
    porPlan,
    errores,
    alertas,
    sugerencias,
    calidadPromedio: qN ? Math.round(qSum / qN) : null,
  };
}

/** Clave estable de los problemas (para detectar cuándo aparece uno nuevo). */
export function issuesKey(issues: ListingIssue[]): string {
  return issues
    .map((i) => `${i.level}:${i.rule}`)
    .sort()
    .join("|");
}

export const PORTAL_LABEL: Record<string, string> = { zonaprop: "ZonaProp", argenprop: "ArgenProp", mercadolibre: "MercadoLibre" };

export const PLAN_LABEL: Record<string, string> = { simple: "Simple", destacado: "Destacado", superdestacado: "Súper destacado" };

export const STATUS_LABEL: Record<string, string> = {
  ONLINE: "Online",
  NEAR_END: "Por vencer",
  OFFLINE: "Finalizado",
  DRAFT: "Borrador",
  WITHOUT_CREDIT: "Sin cupo",
  VIGENTE: "Vigente",
  RESERVADO: "Reservado",
  SUSPENDIDO: "Suspendido",
};
