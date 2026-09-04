import { PDFDocument, StandardFonts, rgb, PDFName, PDFString, type RGB, type PDFPage } from "pdf-lib";
import { now } from "@/lib/datetime";

/**
 * Genera el PDF del reporte de portafolio: cada propiedad y en qué portal está
 * publicada, con su estado. Client-facing, paleta clara de marca, A4 horizontal.
 * Lo usa /api/reportes/portafolio/pdf (y el script de prueba de scratchpad).
 */

export type PortfolioPublication = { portal: string; status: string; externalId: string | null; permalink: string | null };
export type PortfolioRow = {
  address: string;
  realAddress: string | null;
  referenceCode: string | null;
  city: string | null;
  zone: string | null;
  province: string | null;
  type: string | null;
  status: string;
  operationType: string | null;
  operationPrice: number | null;
  operationCurrency: string | null;
  publications: PortfolioPublication[];
};
export type PortfolioFilters = {
  q?: string;
  status?: string;
  operation?: string;
  type?: string;
  city?: string;
  currency?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
};

/* ── paleta de marca (misma que la guía del asistente) ─────────── */
const hex = (h: string): RGB =>
  rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  surface: hex("#FFFFFF"),
  zebra: hex("#F7F3EC"),
  text: hex("#1B1916"),
  muted: hex("#6B655C"),
  faint: hex("#9A938A"),
  border: hex("#E7E0D4"),
  accent: hex("#C6A15B"),
  dark: hex("#1B1916"),
  green: hex("#4B7A3F"),
  amber: hex("#C08A2B"),
  terra: hex("#C56A4A"),
  sky: hex("#3B6EA5"),
};

/** WinAnsi no tiene algunos símbolos: los reemplazamos / limpiamos. */
function safe(s: string): string {
  return s
    .replace(/→/g, "->")
    .replace(/★/g, "*")
    .replace(/[^\x20-\x7E -ÿ–—''""•…€]/g, "");
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fmtPrice(price: number | null, currency: string | null): string {
  if (price == null) return "—";
  const cur = (currency ?? "").toUpperCase() === "USD" ? "USD" : (currency ?? "$");
  return `${cur} ${Math.round(price).toLocaleString("es-AR")}`;
}

/* ── estado de publicación por portal ──────────────────────────── */
type PortalCell = { label: string; color: RGB };
function portalCell(pub?: PortfolioPublication): PortalCell {
  if (!pub) return { label: "—", color: C.faint };
  switch (pub.status) {
    case "active":
      return { label: "Activo", color: C.green };
    case "paused":
      return { label: "Pausado", color: C.amber };
    case "closed":
      return { label: "Baja", color: C.terra };
    case "error":
      return { label: "Error", color: C.terra };
    case "publishing":
      return { label: "Subiendo", color: C.sky };
    case "draft":
      return { label: "Borrador", color: C.faint };
    default:
      return { label: capitalize(pub.status), color: C.muted };
  }
}

export async function buildPortfolioReportPdf(props: PortfolioRow[], filters: PortfolioFilters = {}): Promise<Uint8Array> {
  const { q, status, operation, type, city, currency, minPrice, maxPrice } = filters;

  // ── resumen ──
  const totalProps = props.length;
  const countActive = (portal: string) =>
    props.filter((p) => p.publications.some((x) => x.portal === portal && x.status === "active")).length;
  const zpActive = countActive("zonaprop");
  const apActive = countActive("argenprop");
  const mlActive = countActive("mercadolibre");
  const sinPublicar = props.filter((p) => !p.publications.some((x) => x.status === "active")).length;

  /* ── PDF (A4 horizontal) ─────────────────────────────────────── */
  const pdf = await PDFDocument.create();
  const fontR = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 842;
  const H = 595;
  const M = 40;

  // columnas de la tabla
  const COL = { dir: M, city: 300, tipo: 402, precio: 560, zp: 574, ap: 660, ml: 746 };
  const zpW = 84;

  let page = pdf.addPage([W, H]);
  let y = H;

  const draw = (t: string, x: number, yy: number, size: number, font = fontR, color = C.text) =>
    page.drawText(safe(t), { x, y: yy, size, font, color });
  const drawRight = (t: string, xRight: number, yy: number, size: number, font = fontR, color = C.text) =>
    page.drawText(safe(t), { x: xRight - font.widthOfTextAtSize(safe(t), size), y: yy, size, font, color });

  function clip(t: string, max: number, size: number, font = fontR): string {
    let s = safe(t);
    if (font.widthOfTextAtSize(s, size) <= max) return s;
    while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > max) s = s.slice(0, -1);
    return s + "…";
  }

  // Anota un área clicable (link a URL externa) sobre `pg`.
  function addLink(pg: PDFPage, x: number, yBottom: number, w: number, h: number, uri: string) {
    const annot = pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, yBottom, x + w, yBottom + h],
      Border: [0, 0, 0],
      A: pdf.context.obj({ Type: "Action", S: "URI", URI: PDFString.of(uri) }),
    });
    const ref = pdf.context.register(annot);
    const existing = pg.node.get(PDFName.of("Annots"));
    if (existing) {
      // @ts-expect-error PDFArray.push existe en runtime
      existing.push(ref);
    } else {
      pg.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
    }
  }

  function drawTableHead() {
    page.drawRectangle({ x: M, y: y - 20, width: W - M * 2, height: 20, color: C.dark });
    const ly = y - 14;
    draw("DIRECCIÓN", COL.dir + 8, ly, 7.5, fontB, C.surface);
    draw("CIUDAD / ZONA", COL.city, ly, 7.5, fontB, C.surface);
    draw("TIPO · OPERACIÓN", COL.tipo, ly, 7.5, fontB, C.surface);
    drawRight("PRECIO", COL.precio, ly, 7.5, fontB, C.surface);
    draw("ZONAPROP", COL.zp, ly, 7.5, fontB, C.surface);
    draw("ARGENPROP", COL.ap, ly, 7.5, fontB, C.surface);
    draw("MERC. LIBRE", COL.ml, ly, 7.5, fontB, C.surface);
    y -= 20;
  }

  // ── encabezado (primera página) ──
  const headerH = 66;
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: C.surface });
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: 3, color: C.accent });
  y = H - 26;
  draw("REPORTE DE PORTAFOLIO", M, y, 17, fontB, C.text);
  draw("Juliana Profitos Propiedades", M, y - 16, 9.5, fontR, C.muted);
  const genStr = `Generado: ${now().toFormat("dd/MM/yyyy HH:mm")} · ${totalProps} propiedad${totalProps !== 1 ? "es" : ""}`;
  drawRight(genStr, W - M, y, 9, fontR, C.muted);
  // chips de filtros aplicados
  const activeFilters: string[] = [];
  if (q) activeFilters.push(`Búsqueda: "${q}"`);
  if (status) activeFilters.push(`Estado: ${capitalize(status)}`);
  if (operation) activeFilters.push(`Operación: ${capitalize(operation)}`);
  if (type) activeFilters.push(`Tipo: ${capitalize(type)}`);
  if (city) activeFilters.push(`Ciudad: ${city}`);
  if (currency) activeFilters.push(`Moneda: ${currency}`);
  if (minPrice != null) activeFilters.push(`Desde ${minPrice.toLocaleString("es-AR")}`);
  if (maxPrice != null) activeFilters.push(`Hasta ${maxPrice.toLocaleString("es-AR")}`);
  drawRight(activeFilters.length ? activeFilters.join("  ·  ") : "Todas las propiedades", W - M, y - 16, 8, fontR, C.faint);

  y = H - headerH - 16;

  // ── tarjetas resumen ──
  const cards: { label: string; value: string; color: RGB }[] = [
    { label: "TOTAL", value: String(totalProps), color: C.text },
    { label: "EN ZONAPROP", value: String(zpActive), color: C.green },
    { label: "EN ARGENPROP", value: String(apActive), color: C.green },
    { label: "EN MERC. LIBRE", value: String(mlActive), color: C.green },
    { label: "SIN PUBLICAR", value: String(sinPublicar), color: sinPublicar > 0 ? C.terra : C.muted },
  ];
  const cardGap = 10;
  const cardW = (W - M * 2 - cardGap * (cards.length - 1)) / cards.length;
  const cardH = 42;
  cards.forEach((c, i) => {
    const cx = M + i * (cardW + cardGap);
    page.drawRectangle({ x: cx, y: y - cardH, width: cardW, height: cardH, color: C.surface, borderColor: C.border, borderWidth: 1 });
    page.drawRectangle({ x: cx, y: y - cardH, width: 3, height: cardH, color: c.color });
    draw(c.value, cx + 12, y - 22, 18, fontB, c.color);
    draw(c.label, cx + 12, y - 34, 7, fontR, C.faint);
  });
  y -= cardH + 16;

  // ── tabla ──
  drawTableHead();
  let zebra = false;
  for (const p of props) {
    if (y - 20 < M + 24) {
      page = pdf.addPage([W, H]);
      y = H - M;
      drawTableHead();
      zebra = false;
    }
    const rowH = 20;
    if (zebra) page.drawRectangle({ x: M, y: y - rowH, width: W - M * 2, height: rowH, color: C.zebra });
    zebra = !zebra;

    const ly = y - 9;
    const ly2 = y - 16;
    const addr = p.realAddress || p.address || "Sin dirección";
    draw(clip(addr, COL.city - COL.dir - 16, 8.5, fontB), COL.dir + 8, ly, 8.5, fontB, C.text);
    if (p.referenceCode) draw(clip(`Ref ${p.referenceCode}`, COL.city - COL.dir - 16, 6.5), COL.dir + 8, ly2, 6.5, fontR, C.faint);

    const loc = [p.city, p.zone].filter(Boolean).join(" · ") || p.province || "—";
    draw(clip(loc, COL.tipo - COL.city - 6, 8), COL.city, ly - 3, 8, fontR, C.muted);

    const tipoOp =
      [p.type ? capitalize(p.type) : null, p.operationType ? capitalize(p.operationType) : null].filter(Boolean).join(" · ") || "—";
    draw(clip(tipoOp, COL.precio - 20 - COL.tipo, 8), COL.tipo, ly - 3, 8, fontR, C.muted);

    drawRight(fmtPrice(p.operationPrice, p.operationCurrency), COL.precio, ly - 3, 8.5, fontB, C.text);

    const byPortal = (portal: string) => p.publications.find((x) => x.portal === portal);
    (
      [
        [COL.zp, "zonaprop"],
        [COL.ap, "argenprop"],
        [COL.ml, "mercadolibre"],
      ] as [number, string][]
    ).forEach(([x, portal]) => {
      const pub = byPortal(portal);
      const cell = portalCell(pub);
      page.drawCircle({ x: x + 3, y: ly - 0.5, size: 2.5, color: cell.color });
      const label = clip(cell.label, zpW - 12, 7.5);
      const tx = x + 9;
      draw(label, tx, ly - 3, 7.5, fontR, cell.color);
      // Link clicable al aviso en el portal (si hay permalink).
      const permalink = pub?.permalink;
      if (permalink) {
        const lw = fontR.widthOfTextAtSize(label, 7.5);
        page.drawLine({ start: { x: tx, y: ly - 5 }, end: { x: tx + lw, y: ly - 5 }, thickness: 0.4, color: cell.color });
        addLink(page, x, y - rowH + 2, zpW - 6, rowH - 2, permalink);
      }
    });

    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: W - M, y: y - rowH }, thickness: 0.4, color: C.border });
    y -= rowH;
  }

  if (props.length === 0) {
    y -= 24;
    draw("No hay propiedades que coincidan con los filtros aplicados.", M + 8, y, 10, fontR, C.muted);
  }

  // ── footer en cada página ──
  const pages = pdf.getPages();
  const totalPages = pages.length;
  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M, y: 26 }, end: { x: W - M, y: 26 }, thickness: 0.5, color: C.border });
    pg.drawText("Profitos Propiedades", { x: M, y: 16, size: 7, font: fontR, color: C.faint });
    const lbl = `${i + 1} / ${totalPages}`;
    pg.drawText(lbl, { x: W - M - fontR.widthOfTextAtSize(lbl, 7), y: 16, size: 7, font: fontR, color: C.faint });
  });

  return pdf.save();
}
