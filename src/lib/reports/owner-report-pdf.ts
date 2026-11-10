import { DateTime } from "luxon";
import { rgb, type PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { OwnerReportStats } from "./owner-stats";
import { trendLabel, vsSegment } from "./owner-stats-calc";

/**
 * Hojas del "Informe para propietario" (después de la ficha): rendimiento del
 * aviso en ZonaProp, consultas recibidas, visitas y comentarios del equipo.
 * A4 vertical, Helvetica (WinAnsi: nada de flechas ni emojis → se limpian).
 */

const W = 595;
const H = 842;
const M = 28;
const CW = W - M * 2;
const FOOTER_TOP = 70;
const TZ = "America/Argentina/Buenos_Aires";

const C = {
  ink: rgb(0.08, 0.1, 0.14),
  text: rgb(0.2, 0.22, 0.25),
  muted: rgb(0.42, 0.44, 0.48),
  faint: rgb(0.62, 0.64, 0.67),
  line: rgb(0.85, 0.86, 0.88),
  card: rgb(0.955, 0.957, 0.965),
  band: rgb(0.9, 0.91, 0.93),
  dark: rgb(0.01, 0.01, 0.01),
  accent: rgb(0.86, 0.28, 0.2),
  up: rgb(0.12, 0.52, 0.3),
  down: rgb(0.74, 0.22, 0.16),
  white: rgb(1, 1, 1),
};

export type OwnerReportInput = {
  address: string;
  stats: OwnerReportStats;
  quejas: string;
  mejoras: string;
  generatedAt: DateTime;
};

type Fonts = { regular: PDFFont; bold: PDFFont };

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("es-AR"));
const fmtDec = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: n < 10 ? 1 : 0 });
const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const monthName = (month: string) => DateTime.fromISO(`${month}-01`, { zone: TZ }).setLocale("es").toFormat("LLLL");

class Writer {
  page!: PDFPage;
  y = 0;
  private encodable = new Map<string, boolean>();

  constructor(
    private pdf: PDFDocument,
    readonly f: Fonts,
    private address: string,
    private footer: string[],
  ) {}

  /** Saca lo que Helvetica (WinAnsi) no puede dibujar: emojis, flechas, etc. */
  clean(s: string): string {
    let out = "";
    for (const ch of s.normalize("NFC").replace(/\r/g, "").replace(/\t/g, " ")) {
      if (ch === "\n") {
        out += ch;
        continue;
      }
      let ok = this.encodable.get(ch);
      if (ok === undefined) {
        try {
          this.f.regular.encodeText(ch);
          ok = true;
        } catch {
          ok = false;
        }
        this.encodable.set(ch, ok);
      }
      if (ok) out += ch;
    }
    return out;
  }

  newPage(title: string) {
    this.page = this.pdf.addPage([W, H]);
    this.page.drawRectangle({ x: 0, y: H - 56, width: W, height: 56, color: C.dark });
    this.text(title, M, H - 34, 16, this.f.bold, C.white);
    this.text(this.address, M, H - 49, 9, this.f.regular, rgb(0.7, 0.72, 0.75));
    this.y = H - 56 - 26;
    this.page.drawLine({ start: { x: M, y: 56 }, end: { x: W - M, y: 56 }, thickness: 0.8, color: C.line });
    this.footer.forEach((t, i) => this.text(t, M + 2, 42 - i * 12, 8.5, this.f.regular, C.muted));
  }

  /** Salta de hoja si no entra un bloque de `h` puntos. */
  ensure(h: number) {
    if (this.y - h < FOOTER_TOP) this.newPage("INFORME PARA PROPIETARIO (cont.)");
  }

  text(s: string, x: number, y: number, size: number, font: PDFFont, color: RGB = C.text) {
    const t = this.clean(s).replace(/\n/g, " ");
    if (t) this.page.drawText(t, { x, y, size, font, color });
  }

  width(s: string, size: number, font: PDFFont) {
    return font.widthOfTextAtSize(this.clean(s), size);
  }

  textRight(s: string, xRight: number, y: number, size: number, font: PDFFont, color: RGB = C.text) {
    this.text(s, xRight - this.width(s, size, font), y, size, font, color);
  }

  wrap(s: string, size: number, font: PDFFont, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const para of this.clean(s).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    while (lines.length && !lines.at(-1)) lines.pop();
    return lines;
  }

  section(title: string, right?: string) {
    this.ensure(40);
    this.text(title, M, this.y, 10.5, this.f.bold, C.ink);
    if (right) this.textRight(right, W - M, this.y, 8.5, this.f.regular, C.muted);
    this.page.drawLine({ start: { x: M, y: this.y - 6 }, end: { x: W - M, y: this.y - 6 }, thickness: 0.6, color: C.line });
    this.y -= 20;
  }

  paragraph(s: string, size = 9.5, color: RGB = C.text, maxLines = 60) {
    const lines = this.wrap(s, size, this.f.regular, CW - 8).slice(0, maxLines);
    for (const l of lines) {
      this.ensure(size + 5);
      this.text(l, M + 4, this.y, size, this.f.regular, color);
      this.y -= size + 4.5;
    }
  }
}

function trendColor(dir: string | undefined) {
  return dir === "up" ? C.up : dir === "down" ? C.down : C.muted;
}

function zonapropBlock(w: Writer, s: OwnerReportStats) {
  const z = s.zonaprop;
  const period = z?.periodFrom && z?.periodTo ? `Últimos 30 días · ${dm(z.periodFrom)} al ${dm(z.periodTo)}` : "Últimos 30 días";
  w.section("RENDIMIENTO DEL AVISO EN ZONAPROP", period);

  if (!z || !z.fetchedAt) {
    w.ensure(52);
    w.page.drawRectangle({ x: M, y: w.y - 34, width: CW, height: 44, color: C.card });
    const msg = z?.error
      ? "ZonaProp no devolvió datos de este aviso en la última consulta."
      : "La propiedad no tiene un aviso activo en ZonaProp vinculado, o sus datos todavía no se descargaron.";
    w.text(msg, M + 12, w.y - 8, 9.5, w.f.regular, C.text);
    w.text("Se actualizan solos una vez por día; también se pueden pedir con «Actualizar» en el informe.", M + 12, w.y - 22, 8.5, w.f.regular, C.muted);
    w.y -= 56;
    return;
  }

  // Tres tarjetas principales (30 días) con la variación que informa el portal.
  const cards: [string, number | null, ReturnType<typeof trendLabel>, string | undefined, string | null][] = [
    ["APARICIONES EN BÚSQUEDAS", z.impressions30, trendLabel(z.trend?.impressions), z.trend?.impressions?.dir, null],
    ["VISITAS AL AVISO", z.visits30, trendLabel(z.trend?.visits), z.trend?.visits?.dir, null],
    [
      "CONSULTAS",
      z.contacts30,
      trendLabel(z.trend?.contacts),
      z.trend?.contacts?.dir,
      z.leads30 !== null && z.contacts30 !== null && z.leads30 !== z.contacts30 ? `de ${fmt(z.leads30)} persona${z.leads30 === 1 ? "" : "s"}` : null,
    ],
  ];
  const gap = 10;
  const cw = (CW - gap * 2) / 3;
  const ch = 76;
  w.ensure(ch + 10);
  cards.forEach(([label, value, trend, dir, extra], i) => {
    const x = M + i * (cw + gap);
    w.page.drawRectangle({ x, y: w.y - ch + 10, width: cw, height: ch, color: C.card });
    w.page.drawRectangle({ x, y: w.y - ch + 10, width: 3, height: ch, color: C.accent });
    w.text(label, x + 12, w.y - 6, 7.5, w.f.bold, C.muted);
    const big = fmt(value);
    w.text(big, x + 12, w.y - 34, 24, w.f.bold, C.ink);
    if (extra) w.text(extra, x + 16 + w.width(big, 24, w.f.bold), w.y - 34, 8.5, w.f.regular, C.muted);
    w.text(trend ?? "Sin período anterior para comparar", x + 12, w.y - 52, 8, w.f.regular, trend ? trendColor(dir) : C.faint);
  });
  w.y -= ch + 6;

  // Fila secundaria: el mes y la vida entera del aviso.
  const month = z.thisMonth;
  const prev = z.lastMonth;
  const small: [string, string][] = [
    [`Visitas en ${monthName(month.month)}`, fmt(month.views)],
    ...(prev.complete && prev.views > 0 ? ([[`Visitas en ${monthName(prev.month)}`, fmt(prev.views)]] as [string, string][]) : []),
    ["Visitas desde que se publicó", fmt(z.totalVisits)],
    ["Interesados desde que se publicó", fmt(z.totalLeads)],
    ["Apariciones desde que se publicó", fmt(z.totalImpressions)],
  ].slice(0, 4) as [string, string][];
  const sw = (CW - gap * (small.length - 1)) / small.length;
  w.ensure(48);
  small.forEach(([label, value], i) => {
    const x = M + i * (sw + gap);
    w.page.drawRectangle({ x, y: w.y - 34, width: sw, height: 42, color: C.white, borderColor: C.line, borderWidth: 0.8 });
    w.text(label, x + 10, w.y - 6, 7.5, w.f.regular, C.muted);
    w.text(value, x + 10, w.y - 25, 14, w.f.bold, C.ink);
  });
  w.y -= 50;

  // Visitas por semana (3 meses) si el portal la dio; si no, por día (30 días).
  const weekly = z.weekly.length >= 4;
  const series = weekly
    ? z.weekly.map((p) => ({ label: dm(p.to), value: p.views }))
    : z.daily.map((p) => ({ label: dm(p.day), value: p.views }));
  if (series.length >= 2) {
    const chartH = 86;
    w.ensure(chartH + 40);
    w.text(weekly ? "Visitas por semana · últimos 3 meses" : "Visitas por día", M, w.y, 9, w.f.bold, C.ink);
    const max = Math.max(1, ...series.map((d) => d.value));
    w.textRight(`máximo ${fmt(max)} en ${weekly ? "una semana" : "un día"}`, W - M, w.y, 8, w.f.regular, C.muted);
    const top = w.y - 10;
    const base = top - chartH;
    w.page.drawLine({ start: { x: M, y: base }, end: { x: W - M, y: base }, thickness: 0.6, color: C.line });
    const n = series.length;
    const slot = CW / n;
    const bw = Math.max(2, slot * (weekly ? 0.58 : 0.66));
    series.forEach((d, i) => {
      const h = (d.value / max) * (chartH - 16);
      const x = M + i * slot + (slot - bw) / 2;
      if (h > 0) w.page.drawRectangle({ x, y: base, width: bw, height: Math.max(1, h), color: i === n - 1 ? C.accent : rgb(0.36, 0.39, 0.45) });
      // Semanal: el número arriba de cada barra (son pocas y se leen bien).
      if (weekly) {
        const v = fmt(d.value);
        w.text(v, x + bw / 2 - w.width(v, 7, w.f.regular) / 2, base + h + 3, 7, w.f.regular, C.muted);
      }
    });
    const labelAt = weekly ? series.map((_, i) => i).filter((i) => i % 2 === (n - 1) % 2) : [0, Math.floor((n - 1) / 2), n - 1];
    for (const i of labelAt) {
      const label = weekly ? `${series[i].label}` : series[i].label;
      const lw = w.width(label, 7, w.f.regular);
      const cx = M + i * slot + slot / 2;
      w.text(label, Math.min(W - M - lw, Math.max(M, cx - lw / 2)), base - 10, 7, w.f.regular, C.muted);
    }
    if (weekly) w.textRight("cada barra = semana que termina ese día; en rojo, la última", W - M, base - 21, 7, w.f.regular, C.faint);
    w.y = base - (weekly ? 34 : 28);
  }

  // Comparación contra avisos parecidos (segmento del portal).
  const seg = z.segment;
  if (seg && (seg.visits !== null || seg.leads !== null)) {
    const rows: [string, number | null, number | null][] = [
      ["Apariciones en búsquedas", z.impressions30, seg.impressions],
      ["Visitas al aviso", z.visits30, seg.visits],
      ["Consultas", z.contacts30, seg.leads],
    ];
    w.ensure(30 + rows.length * 17);
    w.text("Comparación con avisos parecidos en ZonaProp (30 días)", M, w.y, 9, w.f.bold, C.ink);
    w.y -= 15;
    const cols = [M + 4, M + 200, M + 300, M + 400];
    w.text("", cols[0], w.y, 7.5, w.f.bold, C.muted);
    w.text("ESTE AVISO", cols[1], w.y, 7.5, w.f.bold, C.muted);
    w.text("PROMEDIO PARECIDOS", cols[2], w.y, 7.5, w.f.bold, C.muted);
    w.text("LECTURA", cols[3], w.y, 7.5, w.f.bold, C.muted);
    w.y -= 13;
    for (const [label, own, avg] of rows) {
      const read = vsSegment(own, avg);
      w.text(label, cols[0], w.y, 9, w.f.regular, C.text);
      w.text(fmt(own), cols[1], w.y, 9, w.f.bold, C.ink);
      w.text(fmtDec(avg), cols[2], w.y, 9, w.f.regular, C.text);
      w.text(read?.label ?? "—", cols[3], w.y, 9, w.f.regular, read ? (read.ratio >= 1.15 ? C.up : read.ratio <= 0.85 ? C.down : C.muted) : C.faint);
      w.page.drawLine({ start: { x: M, y: w.y - 5 }, end: { x: W - M, y: w.y - 5 }, thickness: 0.4, color: C.line });
      w.y -= 16;
    }
    w.y -= 6;
  }

  // Por dónde consultaron (30 días).
  const ch2 = z.contactsByChannel;
  if (ch2 && (z.contacts30 ?? 0) > 0) {
    const parts = [
      ["WhatsApp", ch2.whatsapp],
      ["formulario", ch2.leadForm],
      ["ver teléfono", ch2.viewData],
      ["redes sociales", ch2.socialAds],
    ].filter(([, n]) => (n as number) > 0);
    w.ensure(18);
    w.text("Por dónde consultaron:", M, w.y, 9, w.f.bold, C.ink);
    w.text(parts.map(([l, n]) => `${l} ${fmt(n as number)}`).join("  ·  "), M + 112, w.y, 9, w.f.regular, C.text);
    w.y -= 22;
  }
}

function inquiriesBlock(w: Writer, s: OwnerReportStats) {
  const inq = s.inquiries;
  const v = s.inPersonVisits;
  const since = inq.since ? `Registradas desde el ${DateTime.fromISO(inq.since, { zone: TZ }).toFormat("dd/MM/yyyy")}` : undefined;
  w.section("CONSULTAS RECIBIDAS Y VISITAS", since);
  const rows: [string, string, string][] = inq.byPortal.map((p) => [p.label, fmt(p.last30), fmt(p.total)]);
  if (v.total > 0) rows.push(["Visitas presenciales agendadas", fmt(v.thisMonth) + " este mes", fmt(v.total)]);
  if (!rows.length) {
    w.paragraph("Todavía no hay consultas registradas para esta propiedad.", 9.5, C.muted);
    w.y -= 8;
    return;
  }
  const cols = [M + 4, M + 300, M + 420];
  w.ensure(16 + rows.length * 16);
  w.text("CANAL", cols[0], w.y, 7.5, w.f.bold, C.muted);
  w.text("ÚLTIMOS 30 DÍAS", cols[1], w.y, 7.5, w.f.bold, C.muted);
  w.text("TOTAL", cols[2], w.y, 7.5, w.f.bold, C.muted);
  w.y -= 13;
  for (const [label, last30, total] of rows) {
    w.text(label, cols[0], w.y, 9, w.f.regular, C.text);
    w.text(last30, cols[1], w.y, 9, w.f.regular, C.text);
    w.text(total, cols[2], w.y, 9, w.f.bold, C.ink);
    w.page.drawLine({ start: { x: M, y: w.y - 5 }, end: { x: W - M, y: w.y - 5 }, thickness: 0.4, color: C.line });
    w.y -= 16;
  }
  w.y -= 10;
}

function notesBlock(w: Writer, title: string, body: string, empty: string) {
  w.section(title);
  const t = body.trim();
  w.paragraph(t || empty, 9.5, t ? C.text : C.muted);
  w.y -= 10;
}

/** Agrega las hojas del informe al propietario al documento. */
export function addOwnerReportPages(pdf: PDFDocument, fonts: Fonts, input: OwnerReportInput) {
  const z = input.stats.zonaprop;
  const footer = [
    `Generado: ${input.generatedAt.toFormat("dd/MM/yyyy HH:mm")} · Informe confidencial para el propietario`,
    z?.fetchedAt
      ? `Fuente de los datos de ZonaProp: panel de anunciante (aviso ${z.externalId}), actualizados al ${DateTime.fromISO(z.fetchedAt, { zone: TZ }).toFormat("dd/MM/yyyy HH:mm")}.`
      : "Consultas: central de mensajes de Profitos.",
  ];
  const w = new Writer(pdf, fonts, input.address, footer);
  w.newPage("INFORME PARA PROPIETARIO");
  zonapropBlock(w, input.stats);
  inquiriesBlock(w, input.stats);
  notesBlock(w, "QUEJAS / OBSERVACIONES", input.quejas, "Sin quejas registradas");
  notesBlock(w, "MEJORAS / SUGERENCIAS", input.mejoras, "Sin mejoras registradas");
}
