import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { INMOBILIARIA, formatReceiptNumber } from "@/lib/inmobiliaria";
import { formatARS, slugifyFilename } from "@/lib/rentals";
import { formatDate } from "@/lib/datetime";

const BUCKET = "recibos";

interface ReceiptInput {
  receiptNumber: number;
  paidAt: Date;
  amountPaid: number;
  commissionAmount: number;
  ownerAmount: number;
  isFull: boolean;
  method: string | null;
  notes: string | null;
  contract: { id: string; title: string | null };
  dueDate: { position: number; dueDate: Date; expectedAmount: number };
  property: { address: string; city: string | null; zone: string | null };
  tenant: { fullName: string; idType: string; idNumber: string; phone?: string | null; email?: string | null };
}

interface ReceiptOutput {
  receiptPath: string;
}

const COLOR_TEXT = rgb(0.07, 0.08, 0.1);
const COLOR_MUTED = rgb(0.42, 0.42, 0.45);
const COLOR_FAINT = rgb(0.65, 0.65, 0.68);
const COLOR_OLIVE = rgb(0.29, 0.32, 0.25); // var(--color-olive-mid) ~ #4b5340
const COLOR_BORDER = rgb(0.85, 0.85, 0.86);

interface DrawTextOptions {
  x: number;
  y: number;
  size?: number;
  font: PDFFont;
  color?: ReturnType<typeof rgb>;
}

function drawText(page: PDFPage, text: string, opts: DrawTextOptions) {
  page.drawText(text, {
    x: opts.x,
    y: opts.y,
    size: opts.size ?? 10,
    font: opts.font,
    color: opts.color ?? COLOR_TEXT,
  });
}

function hLine(page: PDFPage, x1: number, x2: number, y: number, color = COLOR_BORDER) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.5,
    color,
  });
}

/**
 * Genera un comprobante PDF "no fiscal" y lo sube a Supabase Storage.
 * Devuelve el path almacenado.
 */
export async function generateAndStoreReceipt(input: ReceiptInput): Promise<ReceiptOutput> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // Header — block olive con datos de la inmobiliaria
  page.drawRectangle({
    x: margin,
    y: y - 70,
    width: contentWidth,
    height: 70,
    color: COLOR_OLIVE,
  });

  drawText(page, INMOBILIARIA.name.toUpperCase(), {
    x: margin + 16,
    y: y - 28,
    size: 20,
    font: bold,
    color: rgb(0.95, 0.94, 0.91),
  });
  drawText(page, INMOBILIARIA.tagline, {
    x: margin + 16,
    y: y - 46,
    size: 9,
    font: regular,
    color: rgb(0.83, 0.85, 0.74),
  });

  const headerLeft: string[] = [];
  if (INMOBILIARIA.address && INMOBILIARIA.address !== "—") headerLeft.push(INMOBILIARIA.address);
  if (INMOBILIARIA.phone && INMOBILIARIA.phone !== "—") headerLeft.push(`Tel: ${INMOBILIARIA.phone}`);
  if (INMOBILIARIA.email && INMOBILIARIA.email !== "—") headerLeft.push(INMOBILIARIA.email);
  if (INMOBILIARIA.cuit) headerLeft.push(`CUIT: ${INMOBILIARIA.cuit}`);
  drawText(page, headerLeft.join(" · "), {
    x: margin + 16,
    y: y - 60,
    size: 8,
    font: regular,
    color: rgb(0.83, 0.85, 0.74),
  });

  // "RECIBO" + número (a la derecha del header)
  drawText(page, "RECIBO", {
    x: width - margin - 130,
    y: y - 30,
    size: 14,
    font: bold,
    color: rgb(0.95, 0.94, 0.91),
  });
  drawText(page, formatReceiptNumber(input.receiptNumber), {
    x: width - margin - 130,
    y: y - 48,
    size: 12,
    font: bold,
    color: rgb(0.95, 0.94, 0.91),
  });
  drawText(page, "Documento no fiscal", {
    x: width - margin - 130,
    y: y - 62,
    size: 7,
    font: regular,
    color: rgb(0.83, 0.85, 0.74),
  });

  y -= 100;

  // Fecha de emisión + estado del pago
  drawText(page, "Fecha de emisión", {
    x: margin,
    y,
    size: 8,
    font: regular,
    color: COLOR_MUTED,
  });
  drawText(page, formatDate(input.paidAt), {
    x: margin,
    y: y - 14,
    size: 11,
    font: bold,
  });

  drawText(page, "Tipo de pago", {
    x: margin + 200,
    y,
    size: 8,
    font: regular,
    color: COLOR_MUTED,
  });
  drawText(page, input.isFull ? "Pago total" : "Pago parcial", {
    x: margin + 200,
    y: y - 14,
    size: 11,
    font: bold,
  });

  if (input.method) {
    drawText(page, "Método", {
      x: margin + 360,
      y,
      size: 8,
      font: regular,
      color: COLOR_MUTED,
    });
    drawText(page, input.method, {
      x: margin + 360,
      y: y - 14,
      size: 11,
      font: bold,
    });
  }

  y -= 40;
  hLine(page, margin, width - margin, y);
  y -= 22;

  // Recibimos de (inquilino)
  drawText(page, "RECIBIMOS DE", {
    x: margin,
    y,
    size: 8,
    font: bold,
    color: COLOR_MUTED,
  });
  y -= 16;
  drawText(page, input.tenant.fullName, {
    x: margin,
    y,
    size: 13,
    font: bold,
  });
  y -= 14;
  const tenantLine = [`${input.tenant.idType.toUpperCase()}: ${input.tenant.idNumber}`];
  if (input.tenant.phone) tenantLine.push(`Tel: ${input.tenant.phone}`);
  if (input.tenant.email) tenantLine.push(input.tenant.email);
  drawText(page, tenantLine.join("  ·  "), {
    x: margin,
    y,
    size: 9,
    font: regular,
    color: COLOR_MUTED,
  });

  y -= 26;
  hLine(page, margin, width - margin, y);
  y -= 22;

  // Concepto
  drawText(page, "EN CONCEPTO DE", {
    x: margin,
    y,
    size: 8,
    font: bold,
    color: COLOR_MUTED,
  });
  y -= 16;

  const propertyLine = [input.property.address];
  if (input.contract.title) propertyLine.push(input.contract.title);
  drawText(page, propertyLine.join(" — "), {
    x: margin,
    y,
    size: 12,
    font: bold,
  });
  y -= 14;

  const locationParts: string[] = [];
  if (input.property.zone) locationParts.push(input.property.zone);
  if (input.property.city) locationParts.push(input.property.city);
  if (locationParts.length > 0) {
    drawText(page, locationParts.join(" · "), {
      x: margin,
      y,
      size: 9,
      font: regular,
      color: COLOR_MUTED,
    });
    y -= 14;
  }

  drawText(
    page,
    `Cuota Nº ${input.dueDate.position} — vencimiento ${formatDate(input.dueDate.dueDate)}`,
    {
      x: margin,
      y,
      size: 10,
      font: regular,
      color: COLOR_MUTED,
    },
  );
  y -= 14;

  drawText(page, `Monto esperado de la cuota: ${formatARS(input.dueDate.expectedAmount)}`, {
    x: margin,
    y,
    size: 9,
    font: regular,
    color: COLOR_FAINT,
  });

  y -= 36;

  // Total cobrado — destacado
  page.drawRectangle({
    x: margin,
    y: y - 64,
    width: contentWidth,
    height: 64,
    color: rgb(0.97, 0.97, 0.96),
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  drawText(page, "TOTAL COBRADO", {
    x: margin + 18,
    y: y - 22,
    size: 9,
    font: bold,
    color: COLOR_MUTED,
  });
  drawText(page, formatARS(input.amountPaid, { decimals: true }), {
    x: margin + 18,
    y: y - 50,
    size: 24,
    font: bold,
    color: COLOR_OLIVE,
  });

  if (!input.isFull) {
    const pendingAmount = Math.max(0, input.dueDate.expectedAmount - input.amountPaid);
    drawText(page, "Saldo pendiente (informativo)", {
      x: margin + contentWidth - 200,
      y: y - 22,
      size: 8,
      font: regular,
      color: COLOR_MUTED,
    });
    drawText(page, formatARS(pendingAmount, { decimals: true }), {
      x: margin + contentWidth - 200,
      y: y - 42,
      size: 14,
      font: bold,
      color: COLOR_TEXT,
    });
  }

  y -= 90;

  // Notas
  if (input.notes) {
    drawText(page, "OBSERVACIONES", {
      x: margin,
      y,
      size: 8,
      font: bold,
      color: COLOR_MUTED,
    });
    y -= 14;
    const noteLines = wrapText(input.notes, 95);
    for (const line of noteLines.slice(0, 6)) {
      drawText(page, line, { x: margin, y, size: 10, font: regular });
      y -= 14;
    }
    y -= 12;
  }

  // Footer
  const footerY = margin + 50;
  hLine(page, margin, width - margin, footerY + 28);
  drawText(
    page,
    "Este documento es un comprobante interno de pago, sin valor fiscal. Para factura solicitarla por separado.",
    { x: margin, y: footerY + 12, size: 8, font: regular, color: COLOR_FAINT },
  );
  drawText(
    page,
    `Comprobante ${formatReceiptNumber(input.receiptNumber)} · emitido el ${formatDate(new Date())}`,
    { x: margin, y: footerY, size: 7, font: regular, color: COLOR_FAINT },
  );

  const bytes = await pdf.save();
  const supabase = await createClient();
  const safeContract = slugifyFilename(input.contract.title ?? input.property.address).slice(0, 40);
  const fileName = `recibo_${formatReceiptNumber(input.receiptNumber).replace(/-/g, "_")}_${safeContract || "alquiler"}.pdf`;
  const path = `comprobantes/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`No se pudo guardar el comprobante: ${error.message}`);

  return { receiptPath: path };
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
