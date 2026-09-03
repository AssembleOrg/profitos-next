import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { EmployeeReport, ObjetivoEstado } from "./employee-report";

/**
 * PDF del reporte de desempeño con la paleta "Cálido Expresivo" de la web
 * (globals.css): fondo hueso, tinta cálida, dorado de acento, oliva/terra para
 * estados. Dibujado a mano con pdf-lib (no hay HTML→PDF en el proyecto).
 */

// Paleta (globals.css) --------------------------------------------------------
const C = {
  bg: rgb(0.98, 0.968, 0.949), // #FAF7F2
  surface: rgb(1, 1, 1),
  elevated: rgb(0.961, 0.945, 0.914), // #F5F1E9
  text: rgb(0.106, 0.098, 0.086), // #1B1916
  muted: rgb(0.341, 0.325, 0.29), // #57534A
  faint: rgb(0.557, 0.537, 0.49), // #8E897D
  border: rgb(0.925, 0.902, 0.855), // #ECE6DA
  accent: rgb(0.776, 0.631, 0.357), // #C6A15B
  terra: rgb(0.773, 0.416, 0.29), // #C56A4A
  olive: rgb(0.424, 0.478, 0.353), // #6C7A5A
  warning: rgb(0.698, 0.478, 0.204), // #B27A34
  danger: rgb(0.663, 0.298, 0.271), // #A94C45
  info: rgb(0.357, 0.447, 0.522), // #5B7285
  sage: rgb(0.914, 0.929, 0.878), // #E9EDE0
  sand: rgb(0.953, 0.918, 0.851), // #F3EAD9
  clay: rgb(0.965, 0.89, 0.859), // #F6E3DB
  infoChip: rgb(0.902, 0.922, 0.937), // #E6EBEF
  dark: rgb(0.106, 0.098, 0.086),
  darkFg: rgb(0.98, 0.968, 0.949),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 34;

const ESTADO_OBJ: Record<ObjetivoEstado, { label: string; fg: RGB; bg: RGB }> = {
  cumplido: { label: "Cumplido", fg: C.olive, bg: C.sage },
  parcial: { label: "Parcial", fg: C.warning, bg: C.sand },
  fallido: { label: "No cumplido", fg: C.danger, bg: C.clay },
  en_curso: { label: "En curso", fg: C.info, bg: C.infoChip },
  vencido: { label: "Vencido", fg: C.terra, bg: C.clay },
};

const ESTADO_SEG: Record<string, { fg: RGB; bg: RGB }> = {
  hecho: { fg: C.olive, bg: C.sage },
  cancelado: { fg: C.faint, bg: C.elevated },
  pendiente: { fg: C.warning, bg: C.sand },
  en_progreso: { fg: C.info, bg: C.infoChip },
};

// Helpers ---------------------------------------------------------------------
/** Helvetica (WinAnsi) no codifica cualquier unicode: se limpia lo que rompe. */
function safe(s: unknown): string {
  return String(s ?? "")
    .replace(/[→⇒]/g, "->")
    .replace(/[✓✔]/g, "OK")
    .replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(probe, size) <= maxWidth) {
      line = probe;
    } else {
      if (line) lines.push(line);
      // palabra más larga que el ancho: cortar duro
      let rest = w;
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function ellipsis(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let s = safe(text);
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  pages: PDFPage[];
};

function newPage(ctx: Ctx): void {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.bg });
  ctx.page = page;
  ctx.pages.push(page);
  ctx.y = PAGE_H - MARGIN;
}

/** Garantiza `h` puntos de alto disponibles; si no, pasa de página. */
function ensure(ctx: Ctx, h: number): void {
  if (ctx.y - h < MARGIN + FOOTER_H) newPage(ctx);
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = C.text): void {
  ctx.page.drawText(safe(s), { x, y, size, font, color });
}

function chip(ctx: Ctx, label: string, x: number, y: number, fg: RGB, bg: RGB, size = 7.5): number {
  const w = ctx.bold.widthOfTextAtSize(safe(label), size) + 12;
  ctx.page.drawRectangle({ x, y: y - 3.5, width: w, height: size + 7, color: bg });
  text(ctx, label, x + 6, y, size, ctx.bold, fg);
  return w;
}

function sectionTitle(ctx: Ctx, title: string, subtitle?: string): void {
  ensure(ctx, 40);
  ctx.y -= 10;
  text(ctx, title.toUpperCase(), MARGIN, ctx.y, 9, ctx.bold, C.accent);
  if (subtitle) {
    const w = ctx.bold.widthOfTextAtSize(title.toUpperCase(), 9);
    text(ctx, subtitle, MARGIN + w + 8, ctx.y, 8.5, ctx.regular, C.faint);
  }
  ctx.y -= 7;
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + CONTENT_W, y: ctx.y }, thickness: 0.6, color: C.border });
  ctx.y -= 16;
}

function emptyNote(ctx: Ctx, s: string): void {
  ensure(ctx, 18);
  text(ctx, s, MARGIN, ctx.y, 9, ctx.regular, C.faint);
  ctx.y -= 18;
}

/** Fila de tabla con columnas de ancho fijo; devuelve alto usado. */
function tableHeader(ctx: Ctx, cols: { label: string; w: number }[]): void {
  ensure(ctx, 22);
  let x = MARGIN;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 5, width: CONTENT_W, height: 16, color: C.elevated });
  for (const c of cols) {
    text(ctx, c.label.toUpperCase(), x + 6, ctx.y, 7, ctx.bold, C.muted);
    x += c.w;
  }
  ctx.y -= 20;
}

function tableRow(ctx: Ctx, cells: { v: string; w: number; chip?: { fg: RGB; bg: RGB }; bold?: boolean }[]): void {
  ensure(ctx, 18);
  let x = MARGIN;
  for (const c of cells) {
    if (c.chip) chip(ctx, c.v, x + 6, ctx.y, c.chip.fg, c.chip.bg);
    else text(ctx, ellipsis(c.v, c.bold ? ctx.bold : ctx.regular, 8.5, c.w - 12), x + 6, ctx.y, 8.5, c.bold ? ctx.bold : ctx.regular, c.bold ? C.text : C.muted);
    x += c.w;
  }
  ctx.y -= 6;
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + CONTENT_W, y: ctx.y }, thickness: 0.4, color: C.border });
  ctx.y -= 12;
}

// Bloques ---------------------------------------------------------------------
function header(ctx: Ctx, r: EmployeeReport): void {
  const H = 108;
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - H, width: PAGE_W, height: H, color: C.dark });
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - H, width: PAGE_W, height: 3, color: C.accent });
  text(ctx, "PROFITOS", MARGIN, PAGE_H - 34, 10, ctx.bold, C.accent);
  text(ctx, "Juliana Profitos · Inmobiliaria", MARGIN + 62, PAGE_H - 34, 8.5, ctx.regular, C.faint);
  text(ctx, "Reporte de desempeño", MARGIN, PAGE_H - 62, 22, ctx.bold, C.darkFg);
  const nombre = r.member.fullName?.trim() || r.member.email;
  text(ctx, nombre, MARGIN, PAGE_H - 82, 12, ctx.bold, C.accent);
  text(ctx, `${r.member.email} · rol ${r.member.role}`, MARGIN + ctx.bold.widthOfTextAtSize(safe(nombre), 12) + 10, PAGE_H - 82, 8.5, ctx.regular, C.faint);
  const periodo = `Período ${fmtDate(r.range.from)} – ${fmtDate(r.range.to)}  ·  ${r.range.dias} días`;
  const pw = ctx.regular.widthOfTextAtSize(safe(periodo), 9);
  text(ctx, periodo, PAGE_W - MARGIN - pw, PAGE_H - 34, 9, ctx.regular, C.darkFg);
  ctx.y = PAGE_H - H - 18;
}

function resumen(ctx: Ctx, r: EmployeeReport): void {
  const k = r.kpis;
  const pct = (n: number | null) => (n == null ? "—" : `${n}%`);
  const rows: [string, string, string][] = [
    ["Objetivos cumplidos", `${k.objetivos.cumplidos} / ${k.objetivos.total}`, `${k.objetivos.parciales} parciales · ${k.objetivos.enCurso} en curso`],
    ["Cumplimiento de items", pct(k.items.cumplimiento), `${k.items.hechos} hechos · ${k.items.fallidos} fallidos · ${k.items.pendientes} pendientes`],
    ["Visitas", String(k.visitas), `${r.accionesPorTipo.visita ?? 0} registradas en seguimientos`],
    ["Seguimientos resueltos", `${k.seguimientos.completados} / ${k.seguimientos.asignados}`, `tasa ${pct(k.seguimientos.tasaResolucion)} · ${k.seguimientos.vencidos} vencidos hoy`],
    ["Contactos tomados", String(k.contactosTomados), "desde la central de mensajes"],
    ["Clientes nuevos", String(k.clientesCreados), `${k.tasaciones} tasaciones`],
    ["Acciones de seguimiento", String(k.acciones), Object.entries(r.accionesPorTipo).map(([t, n]) => `${n} ${t}`).join(" · ") || "sin acciones"],
    ["Actividad por día", String(k.actividadPorDia), `${k.propiedadesACargo} propiedades a cargo`],
  ];
  sectionTitle(ctx, "Resumen del período", `${r.range.dias} días`);
  const cols = [
    { label: "Indicador", w: 170 },
    { label: "Valor", w: 70 },
    { label: "Detalle", w: CONTENT_W - 240 },
  ];
  tableHeader(ctx, cols);
  for (const [label, value, sub] of rows) {
    tableRow(ctx, [
      { v: label, w: cols[0].w, bold: true },
      { v: value, w: cols[1].w, bold: true },
      { v: sub, w: cols[2].w },
    ]);
  }
}

function objetivos(ctx: Ctx, r: EmployeeReport): void {
  sectionTitle(ctx, "Objetivos", `${r.objetivos.length} en el período`);
  if (!r.objetivos.length) return emptyNote(ctx, "Sin objetivos asignados en el período.");
  for (const o of r.objetivos) {
    const titleLines = wrap(o.titulo, ctx.bold, 10.5, CONTENT_W - 120);
    const descLines = o.descripcion ? wrap(o.descripcion, ctx.regular, 8.5, CONTENT_W - 24).slice(0, 3) : [];
    const h = titleLines.length * 13 + 12 + descLines.length * 11 + o.items.length * 13 + 16;
    ensure(ctx, Math.min(h, 200));
    let y = ctx.y;
    const est = ESTADO_OBJ[o.estado];
    titleLines.forEach((l, i) => text(ctx, l, MARGIN, y - i * 13, 10.5, ctx.bold, C.text));
    const cw = ctx.bold.widthOfTextAtSize(safe(est.label), 7.5) + 12;
    chip(ctx, est.label, MARGIN + CONTENT_W - cw, y, est.fg, est.bg);
    y -= titleLines.length * 13;
    text(ctx, `${fmtDate(o.desde)} – ${fmtDate(o.hasta)}`, MARGIN, y, 8, ctx.regular, C.faint);
    y -= 12;
    for (const l of descLines) {
      text(ctx, l, MARGIN, y, 8.5, ctx.regular, C.muted);
      y -= 11;
    }
    y -= 2;
    for (const it of o.items) {
      if (y < MARGIN + FOOTER_H + 14) {
        newPage(ctx);
        y = ctx.y - 6;
      }
      const dot = it.estado === "done" ? C.olive : it.estado === "failed" ? C.danger : C.border;
      ctx.page.drawCircle({ x: MARGIN + 6, y: y + 3, size: 3.2, color: dot });
      const label = it.estado === "done" ? "hecho" : it.estado === "failed" ? "fallido" : "pendiente";
      text(ctx, ellipsis(it.texto, ctx.regular, 8.5, CONTENT_W - 90), MARGIN + 14, y, 8.5, ctx.regular, it.estado === "failed" ? C.danger : C.text);
      text(ctx, label, MARGIN + CONTENT_W - 48, y, 7.5, ctx.regular, C.faint);
      y -= 13;
    }
    // Regla separadora entre objetivos (mismo patrón que las tablas)
    y -= 2;
    ctx.page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.4, color: C.border });
    ctx.y = y - 14;
  }
}

function visitas(ctx: Ctx, r: EmployeeReport): void {
  sectionTitle(ctx, "Visitas y agenda", `${r.visitas.length} en el período`);
  if (!r.visitas.length) return emptyNote(ctx, "Sin visitas agendadas en el período.");
  const cols = [
    { label: "Fecha", w: 70 },
    { label: "Hora", w: 62 },
    { label: "Tipo", w: 70 },
    { label: "Título", w: 150 },
    { label: "Propiedad / cliente", w: CONTENT_W - 352 },
  ];
  tableHeader(ctx, cols);
  for (const v of r.visitas.slice(0, 60)) {
    tableRow(ctx, [
      { v: fmtDate(v.fecha), w: cols[0].w, bold: true },
      { v: v.hora || "—", w: cols[1].w },
      { v: v.tipo.replace(/_/g, " "), w: cols[2].w },
      { v: v.titulo, w: cols[3].w },
      { v: [v.propiedad, v.cliente].filter(Boolean).join(" · ") || "—", w: cols[4].w },
    ]);
  }
  if (r.visitas.length > 60) emptyNote(ctx, `… y ${r.visitas.length - 60} más.`);
}

function seguimientos(ctx: Ctx, r: EmployeeReport): void {
  sectionTitle(ctx, "Seguimientos asignados", `${r.seguimientos.length} creados en el período`);
  if (!r.seguimientos.length) return emptyNote(ctx, "Sin seguimientos asignados en el período.");
  const cols = [
    { label: "Propiedad", w: 180 },
    { label: "Seguimiento", w: 150 },
    { label: "Estado", w: 80 },
    { label: "Vence", w: 62 },
    { label: "Acciones", w: CONTENT_W - 472 },
  ];
  tableHeader(ctx, cols);
  for (const s of r.seguimientos.slice(0, 60)) {
    const st = ESTADO_SEG[s.estado] ?? { fg: C.muted, bg: C.elevated };
    tableRow(ctx, [
      { v: s.propiedad, w: cols[0].w, bold: true },
      { v: s.titulo ?? "—", w: cols[1].w },
      { v: s.estado.replace(/_/g, " "), w: cols[2].w, chip: st },
      { v: fmtDate(s.vence), w: cols[3].w },
      { v: String(s.acciones), w: cols[4].w },
    ]);
  }
  if (r.seguimientos.length > 60) emptyNote(ctx, `… y ${r.seguimientos.length - 60} más.`);
}

function contactos(ctx: Ctx, r: EmployeeReport): void {
  sectionTitle(ctx, "Contactos tomados", `${r.contactos.length} · clientes nuevos: ${r.clientes.length}`);
  if (!r.contactos.length && !r.clientes.length) return emptyNote(ctx, "Sin contactos tomados ni clientes nuevos en el período.");
  if (r.contactos.length) {
    const cols = [
      { label: "Fecha", w: 70 },
      { label: "Portal", w: 90 },
      { label: "Cliente", w: 160 },
      { label: "Propiedad", w: CONTENT_W - 320 },
    ];
    tableHeader(ctx, cols);
    for (const c of r.contactos.slice(0, 50)) {
      tableRow(ctx, [
        { v: fmtDate(c.fecha), w: cols[0].w, bold: true },
        { v: c.portal, w: cols[1].w },
        { v: c.nombre ?? "—", w: cols[2].w },
        { v: c.propiedad ?? "—", w: cols[3].w },
      ]);
    }
  }
  if (r.clientes.length) {
    ensure(ctx, 44);
    ctx.y -= 6;
    text(ctx, "Clientes nuevos", MARGIN, ctx.y, 8, ctx.bold, C.muted);
    ctx.y -= 14;
    const cols = [
      { label: "Fecha", w: 70 },
      { label: "Cliente", w: CONTENT_W - 70 },
    ];
    tableHeader(ctx, cols);
    for (const c of r.clientes.slice(0, 25)) {
      tableRow(ctx, [
        { v: fmtDate(c.fecha), w: cols[0].w, bold: true },
        { v: c.nombre, w: cols[1].w },
      ]);
    }
    if (r.clientes.length > 25) emptyNote(ctx, `… y ${r.clientes.length - 25} más.`);
  }
}

function footers(ctx: Ctx, r: EmployeeReport): void {
  const total = ctx.pages.length;
  const generado = `Profitos · Reporte de desempeño · ${r.member.fullName?.trim() || r.member.email} · generado el ${fmtDateTime(new Date())}`;
  ctx.pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN + 14 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 14 }, thickness: 0.5, color: C.border });
    p.drawText(safe(generado), { x: MARGIN, y: MARGIN, size: 7, font: ctx.regular, color: C.faint });
    const pg = `Página ${i + 1} de ${total}`;
    p.drawText(safe(pg), { x: PAGE_W - MARGIN - ctx.regular.widthOfTextAtSize(safe(pg), 7), y: MARGIN, size: 7, font: ctx.regular, color: C.faint });
  });
}

// Entrada ---------------------------------------------------------------------
export async function renderEmployeeReportPdf(r: EmployeeReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Reporte de desempeño — ${r.member.fullName ?? r.member.email}`);
  doc.setAuthor("Profitos");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: null as unknown as PDFPage, y: 0, regular, bold, pages: [] };
  newPage(ctx);
  header(ctx, r);
  resumen(ctx, r);
  objetivos(ctx, r);
  visitas(ctx, r);
  seguimientos(ctx, r);
  contactos(ctx, r);
  footers(ctx, r);
  return doc.save();
}
