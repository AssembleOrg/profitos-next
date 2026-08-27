import type { Page } from "playwright";
import { fetchJsonInPage, withPortalPage, type Portal } from "./session";
import { existingExternalIds, saveLeads, type LeadRow } from "./persist";

const PORTAL: Portal = "argenprop";
const BASE = "https://www.argenprop.com";
const BOOTSTRAP = `${BASE}/micuenta/mismensajes`;
const SECTION = "contactados";
const XHR = { "X-Requested-With": "XMLHttpRequest" };

type Card = {
  idConversacion: string | null;
  idRemitente: string | null;
  fechaTicks: string | null;
  title: string | null;
  propertyAlt: string | null;
  propertyImg: string | null;
  data: string[];
};

type Detail = {
  direccion: string | null;
  precio: string | null;
  link: string | null;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  mensajes: string[];
};

/** .NET DateTime.Ticks (100ns desde 0001-01-01) → Date. */
function ticksToDate(ticks: string | null): Date | null {
  if (!ticks) return null;
  const t = Number(ticks);
  if (!Number.isFinite(t)) return null;
  const ms = t / 10_000 - 62_135_596_800_000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function parseCards(page: Page, html: string): Promise<Card[]> {
  return page.evaluate((raw) => {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    return [...doc.querySelectorAll(".card-chat-item")].map((el) => {
      const img = el.querySelector(".card-chat-photo img");
      return {
        idConversacion: el.getAttribute("data-idconversacion"),
        idRemitente: el.getAttribute("idremitente"),
        fechaTicks: el.getAttribute("data-fecha-ultmensaje"),
        title: el.querySelector(".card-chat-title")?.textContent?.trim() ?? null,
        propertyAlt: img?.getAttribute("alt") ?? null,
        propertyImg: img?.getAttribute("data-src") ?? null,
        data: [...el.querySelectorAll(".card-chat-data span")].map((s) => s.textContent?.trim() ?? ""),
      };
    });
  }, html);
}

async function parseDetail(page: Page, html: string): Promise<Detail> {
  return page.evaluate((raw) => {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const datos = [...doc.querySelectorAll(".dato-interesado-list")].map((d) => d.textContent?.trim() ?? "");
    const email = datos.find((d) => d.includes("@")) ?? null;
    const telefono = datos.find((d) => /^\+?[\d\s().-]{6,}$/.test(d)) ?? null;
    const nombre = datos.find((d) => d && d !== email && d !== telefono) ?? datos[0] ?? null;
    const mensajes = [...doc.querySelectorAll(".theme-quote-container p")]
      .map((p) => p.textContent?.trim() ?? "")
      .filter(Boolean);
    return {
      direccion: doc.querySelector(".aviso-header-direccion")?.textContent?.trim() ?? null,
      precio: doc.querySelector(".aviso-header-monto")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      link: doc.querySelector("a.link-to-property")?.getAttribute("href") ?? null,
      nombre,
      email,
      telefono,
      mensajes,
    };
  }, html);
}

export async function scrapeArgenprop() {
  return withPortalPage(PORTAL, BOOTSTRAP, async (page) => {
    const list = await fetchJsonInPage<{ partial?: string }>(page, BOOTSTRAP, PORTAL, XHR);
    const cards = await parseCards(page, list.partial ?? "");
    const withId = cards.filter((c): c is Card & { idConversacion: string } => Boolean(c.idConversacion));

    const ids = withId.map((c) => c.idConversacion);
    const seen = await existingExternalIds(PORTAL, SECTION, ids);
    const fresh = withId.filter((c) => !seen.has(c.idConversacion));

    const rows: LeadRow[] = [];
    for (const c of fresh) {
      let detail: Detail | null = null;
      if (c.idRemitente) {
        try {
          const d = await fetchJsonInPage<{ partial?: string }>(
            page,
            `${BASE}/conversaciones/chatmensajesview?idConversacion=${c.idConversacion}&idRemitente=${c.idRemitente}`,
            PORTAL,
            XHR
          );
          detail = await parseDetail(page, d.partial ?? "");
        } catch {
          detail = null; // si falla el detalle, guardamos lo de la tarjeta igual
        }
      }

      rows.push({
        portal: PORTAL,
        section: SECTION,
        externalId: c.idConversacion,
        contactName: detail?.nombre ?? null,
        contactEmail: detail?.email ?? null,
        contactPhone: detail?.telefono ?? null,
        messageText: detail?.mensajes.join("\n") || null,
        messageAt: ticksToDate(c.fechaTicks),
        propertyRef: detail?.link?.match(/--(\d+)$/)?.[1] ?? null,
        propertyTitle: c.title ?? c.propertyAlt ?? null,
        propertyAddress: detail?.direccion ?? c.propertyAlt ?? null,
        propertyUrl: detail?.link ? `${BASE}${detail.link}` : null,
        price: detail?.precio ?? null,
        raw: { card: c, detail },
      });
    }

    const nuevos = await saveLeads(rows);
    return { portal: PORTAL, sections: [{ section: SECTION, total: withId.length, nuevos }] };
  });
}
