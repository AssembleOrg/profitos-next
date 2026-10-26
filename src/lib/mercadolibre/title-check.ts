import { prisma } from "@/lib/prisma/client";
import { ML_PORTAL } from "./config";
import { mlFetch } from "./client";

/**
 * Títulos repetidos en la cuenta de MercadoLibre.
 *
 * La cuenta la comparten el sistema y Tokko (cientos de avisos). Un título
 * repetido confunde a quien busca y a cualquier herramienta que reconozca
 * avisos por título, así que no se publica con un título que ya exista en la
 * cuenta, en ningún estado (los cerrados también cuentan).
 */

export interface SameTitleItem {
  id: string;
  title: string;
  status: string;
  permalink: string | null;
}

interface CachedTitles {
  at: number;
  items: SameTitleItem[];
}

const CACHE_MS = 5 * 60_000;
const PAGE = 100;
const MULTIGET = 20;
let cache: CachedTitles | null = null;

/** Normaliza para comparar títulos: sin acentos, minúsculas, sin signos ni espacios dobles. */
export function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function sellerId(): Promise<string> {
  const row = await prisma.portalToken.findUnique({ where: { portal: ML_PORTAL }, select: { externalUser: true } });
  if (!row?.externalUser) throw new Error("MercadoLibre no está conectado");
  return row.externalUser;
}

async function listItemIds(userId: string): Promise<string[]> {
  type Page = { results: string[]; paging: { total: number }; scroll_id?: string };
  const first = await mlFetch<Page>(`/users/${userId}/items/search`, { query: { limit: PAGE, offset: 0 } });
  const ids = [...first.results];
  const total = first.paging.total;
  if (total <= 1000) {
    const offsets: number[] = [];
    for (let off = PAGE; off < total; off += PAGE) offsets.push(off);
    const pages = await Promise.all(
      offsets.map((offset) => mlFetch<Page>(`/users/${userId}/items/search`, { query: { limit: PAGE, offset } }))
    );
    for (const p of pages) ids.push(...p.results);
    return ids;
  }
  // Más de 1000: ML exige scroll.
  const scan: string[] = [];
  let page = await mlFetch<Page>(`/users/${userId}/items/search`, { query: { search_type: "scan", limit: PAGE } });
  while (page.results.length) {
    scan.push(...page.results);
    if (!page.scroll_id) break;
    page = await mlFetch<Page>(`/users/${userId}/items/search`, {
      query: { search_type: "scan", limit: PAGE, scroll_id: page.scroll_id },
    });
  }
  return scan;
}

async function fetchTitles(ids: string[]): Promise<SameTitleItem[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MULTIGET) chunks.push(ids.slice(i, i + MULTIGET));
  const out: SameTitleItem[] = [];
  // De a 6 en paralelo para no pegarle de golpe a ML.
  for (let i = 0; i < chunks.length; i += 6) {
    const batch = await Promise.all(
      chunks.slice(i, i + 6).map((c) =>
        mlFetch<Array<{ code: number; body: { id: string; title: string; status: string; permalink?: string } }>>("/items", {
          query: { ids: c.join(","), attributes: "id,title,status,permalink" },
        })
      )
    );
    for (const res of batch)
      for (const r of res)
        if (r.code === 200 && r.body?.title)
          out.push({ id: r.body.id, title: r.body.title, status: r.body.status, permalink: r.body.permalink ?? null });
  }
  return out;
}

async function accountItems(): Promise<SameTitleItem[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  const items = await fetchTitles(await listItemIds(await sellerId()));
  cache = { at: Date.now(), items };
  return items;
}

/** Suma un aviso recién publicado al caché (para que el próximo chequeo lo vea). */
export function rememberPublishedTitle(item: SameTitleItem) {
  if (!cache) return;
  cache = { at: cache.at, items: [...cache.items.filter((i) => i.id !== item.id), item] };
}

/** Avisos de la cuenta con el mismo título (ignorando `excludeIds`). */
export async function findSameTitleItems(title: string, excludeIds: string[] = []): Promise<SameTitleItem[]> {
  const target = normTitle(title);
  if (!target) return [];
  const skip = new Set(excludeIds.filter(Boolean));
  return (await accountItems()).filter((i) => !skip.has(i.id) && normTitle(i.title) === target);
}

// ─── Sugerencia de título único ─────────────────────────────────────────────

/** "Juan Diaz de Solis 175 Piso 3 Departamento B" → "Juan Diaz de Solis 175". */
export function streetOf(address: string): string {
  return address
    .split(/\s+-\s+|,|\s+(?:piso|depto\.?|departamento|dpto\.?|unidad|uf|pb)\b|\s+\d+\s*[°º]/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bdepartamento\b/gi, "Depto."],
  [/\bambientes\b/gi, "Amb."],
  [/\bambiente\b/gi, "Amb."],
  [/\bdormitorios\b/gi, "Dorm."],
  [/\bcon cochera\b/gi, "c/ Cochera"],
];

function abbreviate(s: string): string {
  return ABBREVIATIONS.reduce((acc, [re, rep]) => acc.replace(re, rep), s);
}

/**
 * Propone un título que incluya la calle (lo que hace único al aviso), dentro
 * de los 60 caracteres de ML. Devuelve null si no se puede armar uno distinto.
 */
export function suggestUniqueTitle(title: string, address: string | null, city: string | null, taken: string[] = []): string | null {
  const street = address ? streetOf(address) : "";
  if (!street) return null;
  const takenNorm = new Set(taken.map(normTitle));
  takenNorm.add(normTitle(title));
  // Lo que va antes del último " - " suele ser "Tipo + ambientes + operación"; lo de después, la zona.
  const dash = title.lastIndexOf(" - ");
  const head = (dash > 0 ? title.slice(0, dash) : title).trim();
  const zone = (dash > 0 ? title.slice(dash + 3) : city ?? "").trim();
  const heads = [head, abbreviate(head)];
  const candidates: string[] = [];
  for (const h of heads) {
    if (normTitle(h).includes(normTitle(street))) continue;
    if (zone && !normTitle(street).includes(normTitle(zone))) candidates.push(`${h} - ${street}, ${zone}`);
    candidates.push(`${h} - ${street}`);
  }
  return candidates.find((c) => c.length <= 60 && !takenNorm.has(normTitle(c))) ?? null;
}
