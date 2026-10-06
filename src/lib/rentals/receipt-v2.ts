import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { INMOBILIARIA } from "@/lib/inmobiliaria";
import { formatARNumber, slugifyFilename } from "@/lib/rentals";
import { amountInWords, formatReceiptNo, type ChargeLine } from "@/lib/rentals/money";

/**
 * Recibos de alquiler v2, con el formato del talonario de la inmobiliaria:
 *
 * - "inquilino":   RECIBO POR CUENTA DE TERCEROS. Por mandato del locador se
 *                  recibe del locatario el total (alquiler + municipal + servicios).
 * - "propietario": RECIBO. El locador recibe de Juliana Profitos el total menos
 *                  honorarios de administración.
 *
 * Se dibuja en A5 vertical (tamaño del talonario) con Helvetica.
 */

export const RECEIPTS_BUCKET = "recibos";

export type ReceiptKind = "inquilino" | "propietario";

export interface ReceiptPdfInput {
  kind: ReceiptKind;
  pointOfSale: number;
  number: number;
  issuedAt: Date;
  currency: string;
  /** Monto total del recibo (inquilino: total cobrado · propietario: neto). */
  amount: number;
  lines: ChargeLine[];
  feeAmount: number;
  feePercent: number;
  periodLabel: string; // "Octubre 2026"
  owner: { fullName: string; idType?: string | null; idNumber?: string | null } | null;
  tenant: { fullName: string; idType: string; idNumber: string };
  property: { address: string; unit?: string | null; city?: string | null; zone?: string | null; type?: string | null };
  notes?: string | null;
  isPartial?: boolean;
}

const INK = rgb(0.106, 0.098, 0.086); // #1B1916
const MUTED = rgb(0.341, 0.325, 0.29); // #57534A
const FAINT = rgb(0.557, 0.537, 0.49); // #8E897D
const RULE = rgb(0.875, 0.847, 0.788); // #DFD8C9
const SAND = rgb(0.953, 0.918, 0.851); // #F3EAD9
const GOLD = rgb(0.776, 0.631, 0.357); // #C6A15B

function text(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size = 8.5, color = INK) {
  page.drawText(value, { x, y, size, font, color });
}

function rule(page: PDFPage, x1: number, x2: number, y: number, color = RULE, thickness = 0.6) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function fit(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** "Mitre 913" → { street: "Mitre", number: "913" } (mejor esfuerzo). */
function splitAddress(address: string): { street: string; number: string } {
  const m = address.trim().match(/^(.*?)[\s,]+(?:N[°º]?\s*)?(\d{1,6})\b(.*)$/i);
  if (!m) return { street: address.trim(), number: "" };
  return { street: m[1].trim(), number: `${m[2]}${m[3] ? m[3].replace(/^[,\s]+/, " ") : ""}`.trim() };
}

function money(amount: number, currency: string) {
  return `${currency === "USD" ? "U$D" : "$"} ${formatARNumber(amount, { decimals: true })}`;
}

export async function renderReceiptPdf(input: ReceiptPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([419.53, 595.28]); // A5
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const m = 26;
  const right = width - m;
  const isTenant = input.kind === "inquilino";

  pdf.setTitle(`${isTenant ? "Recibo por cuenta de terceros" : "Recibo"} ${formatReceiptNo(input.pointOfSale, input.number)}`);
  pdf.setAuthor(INMOBILIARIA.tagline);

  // Marco del recibo
  page.drawRectangle({ x: m - 8, y: m - 8, width: width - (m - 8) * 2, height: height - (m - 8) * 2, borderColor: INK, borderWidth: 1 });

  // ── Cabecera: inmobiliaria · X · número ───────────────────────────
  let y = height - m - 14;
  text(page, "JULIANA", m, y, bold, 15);
  text(page, "PROFITOS", m, y - 15, bold, 15);
  text(page, "PROPIEDADES · COL. 1011", m, y - 27, bold, 6.5, MUTED);
  const contact = [
    INMOBILIARIA.address,
    `Tel. ${INMOBILIARIA.phone}`,
    INMOBILIARIA.email,
    INMOBILIARIA.web,
  ].filter((v) => v && !v.includes("—"));
  contact.forEach((line, i) => text(page, line, m, y - 40 - i * 9.5, regular, 7, MUTED));

  // Caja "X" — documento no válido como factura
  const boxX = width / 2 - 14;
  page.drawRectangle({ x: boxX, y: y - 18, width: 28, height: 28, borderColor: INK, borderWidth: 1.2 });
  text(page, "X", boxX + 8.5, y - 11, bold, 17);
  page.drawLine({ start: { x: width / 2, y: y - 18 }, end: { x: width / 2, y: y - 76 }, thickness: 1, color: INK });

  const noLabel = `N° ${formatReceiptNo(input.pointOfSale, input.number)}`;
  text(page, noLabel, right - bold.widthOfTextAtSize(noLabel, 12), y - 4, bold, 12);
  // Fecha en grilla DÍA / MES / AÑO
  const d = input.issuedAt;
  const ar = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const cellW = 34;
  const gridX = right - cellW * 3;
  const gridY = y - 44;
  ["DÍA", "MES", "AÑO"].forEach((label, i) => {
    const cx = gridX + i * cellW;
    page.drawRectangle({ x: cx, y: gridY, width: cellW, height: 26, borderColor: INK, borderWidth: 0.8 });
    rule(page, cx, cx + cellW, gridY + 15, INK, 0.6);
    text(page, label, cx + (cellW - bold.widthOfTextAtSize(label, 6)) / 2, gridY + 18.5, bold, 6);
    const v = [ar.day, ar.month, ar.year][i] ?? "";
    text(page, v, cx + (cellW - regular.widthOfTextAtSize(v, 8.5)) / 2, gridY + 4.5, regular, 8.5);
  });
  if (INMOBILIARIA.cuit) {
    const cuit = `C.U.I.T.: ${INMOBILIARIA.cuit}`;
    const iibb = `Ing. Brutos: ${INMOBILIARIA.cuit}`;
    text(page, cuit, right - bold.widthOfTextAtSize(cuit, 6.5), gridY - 11, bold, 6.5);
    text(page, iibb, right - bold.widthOfTextAtSize(iibb, 6.5), gridY - 20, bold, 6.5);
  }

  // ── Título ───────────────────────────────────────────────────────
  y = y - 92;
  rule(page, m - 8, width - m + 8, y + 16, INK, 1);
  const title = isTenant ? "RECIBO POR CUENTA DE TERCEROS" : "RECIBO";
  text(page, title, (width - bold.widthOfTextAtSize(title, 12)) / 2, y, bold, 12);
  rule(page, m - 8, width - m + 8, y - 9, INK, 1);

  // ── Locador / Locatario ─────────────────────────────────────────
  y -= 26;
  const half = width / 2;
  const ownerName = input.owner?.fullName ?? "—";
  const ownerId = input.owner?.idNumber ? `${(input.owner.idType ?? "dni").toUpperCase()} ${input.owner.idNumber}` : "—";
  const tenantId = `${input.tenant.idType.toUpperCase()} ${input.tenant.idNumber}`;
  text(page, "Locador:", m, y, bold, 7.5);
  text(page, fit(ownerName, regular, 8.5, half - m - 46), m + 36, y, regular, 8.5);
  text(page, "DNI/CUIT:", m, y - 14, bold, 7.5);
  text(page, fit(ownerId, regular, 8.5, half - m - 46), m + 40, y - 14, regular, 8.5);
  page.drawLine({ start: { x: half - 4, y: y + 12 }, end: { x: half - 4, y: y - 22 }, thickness: 1, color: INK });
  text(page, "Locatario:", half + 4, y, bold, 7.5);
  text(page, fit(input.tenant.fullName, regular, 8.5, right - half - 50), half + 46, y, regular, 8.5);
  text(page, "DNI/CUIT:", half + 4, y - 14, bold, 7.5);
  text(page, fit(tenantId, regular, 8.5, right - half - 50), half + 44, y - 14, regular, 8.5);
  rule(page, m - 8, width - m + 8, y - 22, INK, 1);

  // ── Cuerpo ──────────────────────────────────────────────────────
  y -= 42;
  const lead = isTenant
    ? "Por mandato del locador recibí del locatario la suma de"
    : `Recibí de ${INMOBILIARIA.tagline.split("·")[0].trim().toUpperCase()} la suma de`;
  const body = `${lead} ${amountInWords(input.amount, input.currency)} (${money(input.amount, input.currency)})`;
  for (const line of wrap(body, regular, 8.5, right - m)) {
    text(page, line, m, y, regular, 8.5);
    y -= 12;
  }
  const { street, number } = splitAddress(input.property.address);
  const typeLabel = input.property.type ? input.property.type.toUpperCase() : "LA PROPIEDAD";
  const concept = `en concepto de ALQUILER DE ${typeLabel} que ocupa en la calle ${street}${number ? ` N° ${number}` : ""}${input.property.unit ? `, piso y dpto. ${input.property.unit}` : ""}, localidad ${[input.property.zone, input.property.city].filter(Boolean).join(", ") || "—"}, correspondiente al mes de ${input.periodLabel}.`;
  for (const line of wrap(concept, regular, 8.5, right - m)) {
    text(page, line, m, y, regular, 8.5);
    y -= 12;
  }
  if (input.isPartial) {
    text(page, "Pago parcial a cuenta del período.", m, y, bold, 7.5, MUTED);
    y -= 12;
  }

  // ── Conceptos ───────────────────────────────────────────────────
  y -= 6;
  text(page, "Conceptos", m, y, bold, 7.5, MUTED);
  y -= 6;
  rule(page, m, right, y);
  y -= 12;
  const rows: Array<{ label: string; amount: number }> = input.lines.map((l) => ({ label: l.label, amount: l.amount }));
  if (!isTenant && input.feeAmount > 0) {
    rows.push({ label: `Honorarios administración (${formatARNumber(input.feePercent, { decimals: false })}%)`, amount: -input.feeAmount });
  }
  for (const row of rows.slice(0, 12)) {
    text(page, fit(row.label, regular, 8.5, right - m - 110), m, y, regular, 8.5);
    const value = row.amount < 0 ? `(${money(-row.amount, input.currency)})` : money(row.amount, input.currency);
    text(page, value, right - regular.widthOfTextAtSize(value, 8.5), y, regular, 8.5, row.amount < 0 ? MUTED : INK);
    y -= 5;
    rule(page, m, right, y, RULE, 0.4);
    y -= 11;
  }

  // ── Observaciones ───────────────────────────────────────────────
  if (input.notes?.trim()) {
    y -= 2;
    text(page, "Observaciones", m, y, bold, 7.5, MUTED);
    y -= 11;
    for (const line of wrap(input.notes.trim(), regular, 8, right - m).slice(0, 4)) {
      text(page, line, m, y, regular, 8);
      y -= 10.5;
    }
  }

  // ── Total + firma ───────────────────────────────────────────────
  const footY = m + 34;
  rule(page, m - 8, width - m + 8, footY + 38, INK, 1);
  page.drawRectangle({ x: m - 8, y: m - 8, width: half - m + 4, height: footY + 46 - m, color: SAND });
  rule(page, m - 8, width - m + 8, footY + 38, INK, 1);
  page.drawLine({ start: { x: half - 4, y: m - 8 }, end: { x: half - 4, y: footY + 38 }, thickness: 1, color: INK });
  text(page, "Total", m, footY + 22, bold, 9);
  const total = money(input.amount, input.currency);
  text(page, total, m, footY + 2, bold, 14);
  page.drawRectangle({ x: m, y: footY - 6, width: 30, height: 2, color: GOLD });

  const signer = isTenant ? INMOBILIARIA.tagline.split("·")[0].trim() : ownerName;
  text(page, "Firma", half + 6, footY + 22, bold, 7.5);
  rule(page, half + 34, right, footY + 21, FAINT, 0.5);
  text(page, "Aclaración", half + 6, footY + 2, bold, 7.5);
  rule(page, half + 50, right, footY + 1, FAINT, 0.5);
  text(page, fit(signer, regular, 8, right - half - 56), half + 52, footY + 4, regular, 8, MUTED);

  text(page, "Documento no válido como factura.", half + 6, m - 2, regular, 6, FAINT);

  return pdf.save();
}

export function receiptStoragePath(input: Pick<ReceiptPdfInput, "kind" | "pointOfSale" | "number" | "property">) {
  const slug = slugifyFilename(input.property.address).slice(0, 40) || "alquiler";
  const no = formatReceiptNo(input.pointOfSale, input.number).replace("-", "_");
  return `recibos-v2/${input.kind}/${no}_${slug}.pdf`;
}

/** Sube el PDF con service role (lo usan el staff y el portal; el bucket es privado). */
export async function storeReceiptPdf(path: string, bytes: Uint8Array) {
  const { error } = await supabaseAdmin()
    .storage.from(RECEIPTS_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`No se pudo guardar el recibo: ${error.message}`);
}

export async function signedReceiptUrl(path: string, seconds = 300): Promise<string | null> {
  const { data } = await supabaseAdmin().storage.from(RECEIPTS_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
