import { prisma } from "@/lib/prisma/client";
import { gestionGetHtml } from "@/lib/argenprop/gestion";
import { withZonapropPanel } from "@/lib/zonaprop/browser-publish";

/**
 * Chequeo de avisos de ZonaProp y ArgenProp contra el estado REAL del portal.
 *
 * Un aviso puede bajarse por fuera de Profitos (desde Tokko, desde el panel del
 * portal, o vencer) y el chip seguía diciendo "activo" (caso Olavarría 384,
 * oct 2026). MercadoLibre ya tiene su sync por API (lib/mercadolibre/sync.ts);
 * esto cubre los otros dos portales leyendo sus listados de gestión.
 *
 * Reglas para no romper nada:
 *  - Sólo cambia `status` de avisos que ya tenemos vinculados (externalId).
 *  - Nunca borra filas ni toca avisos en borrador o con error.
 *  - "No aparece en el listado → cerrado" sólo si el listado está completo
 *    (paginación terminada) y no es sospechosamente chico; si no, sólo se
 *    actualizan los que sí aparecieron.
 */

type LiveState = "active" | "paused";
export type ListingSyncResult = {
  portal: string;
  seen: number;
  complete: boolean;
  updated: number;
  closed: number;
  skippedReason?: string;
  /** Cambios aplicados (o que se aplicarían en dry-run): externalId: antes → después. */
  changes: string[];
};
export type ListingSyncOpts = { dryRun?: boolean };

const MAX_PAGES = 40;

async function applyPortalStates(portal: string, live: Map<string, LiveState>, complete: boolean, opts: ListingSyncOpts): Promise<ListingSyncResult> {
  const ours = await prisma.propertyPublication.findMany({
    where: { portal, externalId: { not: null }, status: { in: ["active", "paused", "closed"] } },
    select: { id: true, externalId: true, status: true },
  });
  const activeOurs = ours.filter((p) => p.status === "active" || p.status === "paused").length;

  // Un listado muy chico frente a lo que tenemos publicado huele a sesión rota o
  // a un cambio del portal: no se infiere ningún cierre.
  let canClose = complete;
  let skippedReason: string | undefined;
  if (complete && activeOurs > 0 && live.size < activeOurs * 0.5) {
    canClose = false;
    skippedReason = `listado chico (${live.size} vs ${activeOurs} nuestros activos): no se cierra nada`;
  }

  let updated = 0;
  let closed = 0;
  const changes: string[] = [];
  for (const pub of ours) {
    const state = live.get(pub.externalId!);
    const next = state ?? (canClose && pub.status !== "closed" ? "closed" : null);
    if (!next || next === pub.status) continue;
    // Un aviso nuestro "cerrado" que el portal lista como finalizado (OFFLINE)
    // no cambia nada en la práctica: no se toca. Sí se marca si volvió online.
    if (pub.status === "closed" && next === "paused") continue;
    changes.push(`${pub.externalId}: ${pub.status} → ${next}`);
    if (!opts.dryRun) await prisma.propertyPublication.update({ where: { id: pub.id }, data: { status: next } });
    updated++;
    if (next === "closed") closed++;
  }
  return { portal, seen: live.size, complete, updated, closed, skippedReason, changes };
}

// ─── ZonaProp ────────────────────────────────────────────────────────────────
// GET /avisos-api/panel/api/v2/postings?page=N&limit=M (relevado del bundle del
// panel, oct 2026): cada aviso trae stateAndDates[0].status ONLINE | OFFLINE.
// Los archivados no aparecen.

type ZpListPage = { postings?: { postingId: number; stateAndDates?: { status?: string }[] }[] };

const ZP_PAGE_SIZE = 50;

export async function syncZonapropListings(opts: ListingSyncOpts = {}): Promise<ListingSyncResult> {
  const { live, complete } = await withZonapropPanel(async (page, sessionId) => {
    const live = new Map<string, LiveState>();
    let complete = false;
    for (let n = 1; n <= MAX_PAGES; n++) {
      const res = await page.evaluate(
        async ({ url, sessionId }) => {
          const r = await fetch(url, {
            credentials: "include",
            headers: { accept: "application/json", sessionid: sessionId, "x-panel-portal": "ZPAR" },
          });
          return { status: r.status, text: await r.text() };
        },
        { url: `/avisos-api/panel/api/v2/postings?page=${n}&limit=${ZP_PAGE_SIZE}`, sessionId },
      );
      if (res.status !== 200) throw new Error(`ZonaProp listado página ${n}: HTTP ${res.status}`);
      const postings = (JSON.parse(res.text) as ZpListPage).postings ?? [];
      let nuevos = 0;
      for (const p of postings) {
        const id = String(p.postingId);
        if (live.has(id)) continue;
        nuevos++;
        const st = (p.stateAndDates?.[0]?.status ?? "").toUpperCase();
        live.set(id, st === "ONLINE" ? "active" : "paused");
      }
      // Fin natural: página vacía o incompleta. Si una página trae sólo IDs ya
      // vistos, el portal ignoró la paginación: el listado NO está completo.
      if (postings.length === 0 || postings.length < ZP_PAGE_SIZE) {
        complete = true;
        break;
      }
      if (nuevos === 0) break;
    }
    return { live, complete };
  });
  return applyPortalStates("zonaprop", live, complete, opts);
}

// ─── ArgenProp ───────────────────────────────────────────────────────────────
// Gestión es server-rendered: /propiedades-{estado}[-pagina-N-orden-masnuevos],
// cada tarjeta con data-id-aviso. Se recorren los listados de vigentes,
// reservados (siguen publicados) y suspendidos.

const AP_LISTS: { slug: string; state: LiveState }[] = [
  { slug: "vigente", state: "active" },
  { slug: "reservado", state: "active" },
  { slug: "suspendido", state: "paused" },
];

function apIds(html: string): string[] {
  return [...new Set([...html.matchAll(/data-id-aviso="(\d{5,})"/g)].map((m) => m[1]))];
}

function apLastPage(html: string, slug: string): number {
  const pages = [...html.matchAll(new RegExp(`propiedades-${slug}-pagina-(\\d+)-`, "g"))].map((m) => Number(m[1]));
  return pages.length ? Math.max(...pages) : 1;
}

export async function syncArgenpropListings(opts: ListingSyncOpts = {}): Promise<ListingSyncResult> {
  const live = new Map<string, LiveState>();
  let complete = true;
  for (const { slug, state } of AP_LISTS) {
    const first = await gestionGetHtml(`/propiedades-${slug}`);
    // Si el estado no existe como listado, Gestión cae al de vigentes: se
    // detecta porque el filtro del formulario dice otro estado.
    if (!first.includes(`estadoaviso=${slug}`)) continue;
    const last = Math.min(apLastPage(first, slug), MAX_PAGES);
    const pages = [first];
    for (let n = 2; n <= last; n++) pages.push(await gestionGetHtml(`/propiedades-${slug}-pagina-${n}-orden-masnuevos`));
    if (apLastPage(first, slug) > MAX_PAGES) complete = false;
    for (const html of pages) for (const id of apIds(html)) if (!live.has(id) || state === "active") live.set(id, state);
  }
  return applyPortalStates("argenprop", live, complete, opts);
}
