import type { Page } from "playwright";
import { fetchJsonInPage, getCookie, withPortalPage, type Portal } from "./session";
import { existingExternalIds, saveLeads, type LeadRow } from "./persist";

const PORTAL: Portal = "zonaprop";
const BASE = "https://www.zonaprop.com.ar";
const BOOTSTRAP = `${BASE}/panel/publicador-profesionales/main`;
const LIMIT = 40;
const ENRICH = process.env.ZONAPROP_ENRICH === "true";

const SECTIONS: { key: string; actionTypes: number[] }[] = [
  { key: "mensajes", actionTypes: [1, 3, 2, 12, 14] },
  { key: "telefono", actionTypes: [10] },
  { key: "whatsapp", actionTypes: [6] },
];

type ZpLead = {
  id: string;
  last_lead_date?: string;
  contact_publisher_user_id?: string;
  phone?: string;
  phone_list?: { phone: string }[];
  lead_user?: { name?: string; email?: string; phone?: string };
  last_message?: { text?: string; date?: string };
  posting?: {
    id?: string;
    title?: string;
    address?: string;
    internal_code?: string;
    location?: { name?: string; parent?: { name?: string } };
    price?: { amount?: number; currency?: string };
  };
};

function listUrl(actionTypes: number[]): string {
  const at = actionTypes.map((t) => `action_type=${t}`).join("&");
  return `${BASE}/leads-api/publisher/leads?offset=0&limit=${LIMIT}&spam=false&status=nondiscarded&sort=last_activity&${at}`;
}

function address(p?: ZpLead["posting"]): string | null {
  if (!p) return null;
  const parts = [p.address, p.location?.name, p.location?.parent?.name].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function price(p?: ZpLead["posting"]): string | null {
  const pr = p?.price;
  if (!pr?.amount) return null;
  return `${pr.currency ?? ""} ${pr.amount.toLocaleString("es-AR")}`.trim();
}

function toDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function authHeaders(sessionId: string): Record<string, string> {
  return {
    "x-panel-portal": "ZPAR",
    sessionid: sessionId,
  };
}

async function enrich(
  page: Page,
  headers: Record<string, string>,
  contactId?: string
): Promise<{ profile: unknown; polygon: unknown } | null> {
  if (!contactId) return null;
  try {
    const profile = await fetchJsonInPage<{ searched_locations?: { polygons?: unknown } }>(
      page,
      `${BASE}/leads-api/publisher/contact/${contactId}/user-profile`,
      PORTAL,
      headers
    );
    return { profile, polygon: profile?.searched_locations?.polygons ?? null };
  } catch {
    return null;
  }
}

async function scrapeSection(
  page: Page,
  headers: Record<string, string>,
  section: { key: string; actionTypes: number[] }
): Promise<{ section: string; total: number; nuevos: number }> {
  const data = await fetchJsonInPage<{ result?: ZpLead[] }>(page, listUrl(section.actionTypes), PORTAL, headers);
  const leads = data.result ?? [];
  const ids = leads.map((l) => l.id);
  const seen = await existingExternalIds(PORTAL, section.key, ids);
  const fresh = leads.filter((l) => !seen.has(l.id));

  const rows: LeadRow[] = [];
  for (const l of fresh) {
    const extra = ENRICH ? await enrich(page, headers, l.contact_publisher_user_id) : null;
    const phones = l.phone_list?.map((p) => p.phone).filter(Boolean).join(", ");
    rows.push({
      portal: PORTAL,
      section: section.key,
      externalId: l.id,
      contactName: l.lead_user?.name ?? null,
      contactEmail: l.lead_user?.email ?? null,
      contactPhone: phones || l.phone || l.lead_user?.phone || null,
      messageText: l.last_message?.text ?? null,
      messageAt: toDate(l.last_message?.date) ?? toDate(l.last_lead_date),
      propertyRef: l.posting?.internal_code ?? l.posting?.id ?? null,
      propertyTitle: l.posting?.title ?? null,
      propertyAddress: address(l.posting),
      propertyUrl: null,
      price: price(l.posting),
      mapPolygon: extra?.polygon ?? null,
      raw: { lead: l, profile: extra?.profile ?? null },
    });
  }

  const nuevos = await saveLeads(rows);
  return { section: section.key, total: leads.length, nuevos };
}

export async function scrapeZonaprop() {
  return withPortalPage(PORTAL, BOOTSTRAP, async (page, context) => {
    const sessionId = (await getCookie(context, "sessionId")) ?? "";
    const headers = authHeaders(sessionId);
    const sections = [];
    for (const s of SECTIONS) {
      sections.push(await scrapeSection(page, headers, s));
    }
    return { portal: PORTAL, sections };
  });
}
