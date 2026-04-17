import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFImage, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BUCKET = "tasaciones";

/* ── helpers ──────────────────────────────────────────────── */

const W = 595;
const H = 842;
const M = 36;

function asText(v: string | null | undefined, fallback = "") {
  return (v ?? "").trim() || fallback;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
}

async function fetchStorageImage(filePath: string): Promise<Uint8Array | null> {
  try {
    // If it's a full URL (legacy), fetch directly
    if (filePath.startsWith("http")) return fetchImageBytes(filePath);
    const supabase = await createSupabase();
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch { return null; }
}

async function embedImage(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  // Try JPG/PNG first
  try { return await pdf.embedJpg(bytes); } catch { /* not jpg */ }
  try { return await pdf.embedPng(bytes); } catch { /* not png */ }
  // Convert AVIF/WebP/other to PNG via sharp
  try {
    const pngBuffer = await sharp(Buffer.from(bytes)).png().toBuffer();
    return await pdf.embedPng(new Uint8Array(pngBuffer));
  } catch { return null; }
}

async function loadLocalImage(name: string): Promise<Uint8Array | null> {
  try {
    const p = path.join(process.cwd(), "public", "images", name);
    return new Uint8Array(await readFile(p));
  } catch { return null; }
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/* ── branding footer (on every page) ─────────────────────── */

function drawBranding(
  page: ReturnType<PDFDocument["addPage"]>,
  fontB: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontR: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  const brandX = W - M - 140;
  const brandY = 50;
  page.drawText("Juliana", { x: brandX, y: brandY + 18, size: 22, font: fontB, color: rgb(0.12, 0.12, 0.12) });
  page.drawText("P R O F I T O S", { x: brandX, y: brandY + 2, size: 10, font: fontR, color: rgb(0.25, 0.25, 0.25) });
  page.drawLine({ start: { x: brandX, y: brandY - 2 }, end: { x: brandX + 130, y: brandY - 2 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("Martillera – COL. 1011", { x: brandX + 20, y: brandY - 14, size: 8, font: fontR, color: rgb(0.4, 0.4, 0.4) });
}

/* ── geometric corner decorations (layered angular shapes) ── */

function drawCornerDecorations(page: ReturnType<PDFDocument["addPage"]>) {
  const dark = rgb(0.10, 0.10, 0.10);
  const mid = rgb(0.30, 0.30, 0.30);
  const light = rgb(0.50, 0.50, 0.50);

  // Top-right corner — large layered blocks
  page.drawRectangle({ x: W - 180, y: H - 130, width: 180, height: 130, color: dark });
  page.drawRectangle({ x: W - 140, y: H - 180, width: 140, height: 50, color: mid });
  page.drawRectangle({ x: W - 100, y: H - 210, width: 100, height: 30, color: light });
  // Inner detail squares (rotated feel)
  page.drawRectangle({ x: W - 155, y: H - 105, width: 50, height: 50, color: mid });
  page.drawRectangle({ x: W - 130, y: H - 80, width: 30, height: 30, color: light });

  // Bottom-left corner — large layered blocks
  page.drawRectangle({ x: 0, y: 0, width: 130, height: 180, color: dark });
  page.drawRectangle({ x: 0, y: 180, width: 90, height: 50, color: mid });
  page.drawRectangle({ x: 130, y: 0, width: 50, height: 130, color: mid });
  // Inner detail squares
  page.drawRectangle({ x: 50, y: 50, width: 55, height: 55, color: mid });
  page.drawRectangle({ x: 65, y: 65, width: 35, height: 35, color: light });
  page.drawRectangle({ x: 0, y: 230, width: 60, height: 30, color: light });
}

/* ── route ───────────────────────────────────────────────── */

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await getAuthContext();

    const tasacion = await prisma.tasacion.findUnique({ where: { id } });
    if (!tasacion) return NextResponse.json({ error: "Tasación no encontrada" }, { status: 404 });

    const pdf = await PDFDocument.create();
    const fontR = await pdf.embedFont(StandardFonts.Helvetica);
    const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

    const direccion = asText(tasacion.direccion, "Sin dirección");

    /* ─── PAGE 1: Portada ─────────────────────────────────── */
    const p1 = pdf.addPage([W, H]);
    p1.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
    drawCornerDecorations(p1);

    // Title — centered like the original
    const titleText = "TASACION";
    const titleSize = 56;
    const titleW = fontB.widthOfTextAtSize(titleText, titleSize);
    const titleX = (W - titleW) / 2;
    const titleY = H / 2 + 60;
    p1.drawText(titleText, { x: titleX, y: titleY, size: titleSize, font: fontB, color: rgb(0.10, 0.10, 0.10) });

    // Subtitle with lines on both sides
    const subText = "de un Bien Inmueble";
    const subSize = 18;
    const subW = fontR.widthOfTextAtSize(subText, subSize);
    const subX = (W - subW) / 2;
    const subY = titleY - 40;
    const lineGap = 12;
    p1.drawLine({ start: { x: titleX, y: subY + 7 }, end: { x: subX - lineGap, y: subY + 7 }, thickness: 1.2, color: rgb(0.15, 0.15, 0.15) });
    p1.drawText(subText, { x: subX, y: subY, size: subSize, font: fontR, color: rgb(0.15, 0.15, 0.15) });
    p1.drawLine({ start: { x: subX + subW + lineGap, y: subY + 7 }, end: { x: titleX + titleW, y: subY + 7 }, thickness: 1.2, color: rgb(0.15, 0.15, 0.15) });

    // Address — centered below
    const addrSize = 13;
    const addrW = fontR.widthOfTextAtSize(direccion, addrSize);
    p1.drawText(direccion, {
      x: (W - addrW) / 2,
      y: subY - 40, size: addrSize, font: fontR, color: rgb(0.22, 0.22, 0.22),
    });

    drawBranding(p1, fontB, fontR);

    /* ─── PAGE 2: Tasación Actualizada ────────────────────── */
    const p2 = pdf.addPage([W, H]);
    p2.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });

    // Title bar
    p2.drawRectangle({ x: 0, y: H - 80, width: W * 0.55, height: 80, color: rgb(0.93, 0.93, 0.93) });
    p2.drawText("TASACION", { x: M, y: H - 38, size: 28, font: fontB, color: rgb(0.12, 0.12, 0.12) });
    p2.drawText("ACTUALIZADA.", { x: M, y: H - 66, size: 28, font: fontB, color: rgb(0.12, 0.12, 0.12) });

    // Corner decoration
    p2.drawRectangle({ x: W - 50, y: H - 50, width: 50, height: 50, color: rgb(0.35, 0.35, 0.35) });

    // Intro text
    let y2 = H - 110;
    p2.drawText("A quien corresponda:", { x: M, y: y2, size: 11, font: fontR, color: rgb(0.2, 0.2, 0.2) });
    y2 -= 16;
    const intro = `Nos comunicamos de Juliana Profitos Propiedades para transmitir la tasación estimada del inmueble por el que nos han contactado`;
    p2.drawText(intro, { x: M, y: y2, size: 11, font: fontR, color: rgb(0.2, 0.2, 0.2), maxWidth: W - M * 2, lineHeight: 15 });
    y2 -= 50;

    // Bullets
    const bullets = [
      { label: "Ubicación de la unidad", value: asText(tasacion.ubicacionUnidad, "No informado") },
      { label: "Superficie total dos ambientes:", value: asText(tasacion.superficieTotal, "No informado") },
      { label: "Superficie total monoambiente:", value: asText(tasacion.superficieMono, "No informado") },
      { label: "Condición de venta", value: asText(tasacion.condicionVenta, "No informado") },
    ];

    for (const b of bullets) {
      y2 -= 18;
      p2.drawText("•", { x: M + 8, y: y2, size: 11, font: fontB, color: rgb(0.12, 0.12, 0.12) });
      p2.drawText(`${b.label}: `, { x: M + 22, y: y2, size: 11, font: fontB, color: rgb(0.12, 0.12, 0.12) });
      const labelW = fontB.widthOfTextAtSize(`${b.label}: `, 11);
      p2.drawText(b.value, { x: M + 22 + labelW, y: y2, size: 11, font: fontR, color: rgb(0.2, 0.2, 0.2), maxWidth: W - M * 2 - 22 - labelW, lineHeight: 15 });
    }

    // Map image
    if (tasacion.mapaImageUrl) {
      const mapBytes = await fetchStorageImage(tasacion.mapaImageUrl);
      if (mapBytes) {
        const mapImg = await embedImage(pdf, mapBytes);
        if (mapImg) {
          const mapW = W - M * 2;
          const mapMaxH = 340;
          const scaled = mapImg.scaleToFit(mapW, mapMaxH);
          p2.drawImage(mapImg, {
            x: M + (mapW - scaled.width) / 2,
            y: y2 - 30 - scaled.height,
            width: scaled.width,
            height: scaled.height,
          });
        }
      }
    }

    drawBranding(p2, fontB, fontR);

    /* ─── PAGES 3+: Fotos (2 per page) ───────────────────── */
    const fotos = Array.isArray(tasacion.fotos) ? (tasacion.fotos as string[]).filter(Boolean) : [];

    for (let i = 0; i < fotos.length; i += 2) {
      const pg = pdf.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });

      const photoW = W - M * 2;
      const photoMaxH = 340;

      for (let j = 0; j < 2; j++) {
        const url = fotos[i + j];
        if (!url) continue;

        const bytes = await fetchStorageImage(url);
        if (!bytes) continue;
        const img = await embedImage(pdf, bytes);
        if (!img) continue;

        const scaled = img.scaleToFit(photoW, photoMaxH);
        const yPos = j === 0 ? H - M - scaled.height : H - M - photoMaxH - 20 - scaled.height;
        pg.drawImage(img, {
          x: M + (photoW - scaled.width) / 2,
          y: Math.max(yPos, M + 60),
          width: scaled.width,
          height: scaled.height,
        });
      }

      drawBranding(pg, fontB, fontR);
    }

    /* ─── INFORME page ────────────────────────────────────── */
    if (tasacion.informeHtml) {
      const pg = pdf.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });

      pg.drawText("INFORME", { x: M, y: H - M - 30, size: 28, font: fontB, color: rgb(0.12, 0.12, 0.12) });
      pg.drawLine({ start: { x: M, y: H - M - 36 }, end: { x: W - M, y: H - M - 36 }, thickness: 1, color: rgb(0.12, 0.12, 0.12) });

      // Simple text rendering (rich text in etapa 3)
      const text = tasacion.informeHtml.replace(/<[^>]*>/g, "").trim();
      pg.drawText(text.slice(0, 3000), {
        x: M, y: H - M - 60, size: 11, font: fontR, color: rgb(0.15, 0.15, 0.15),
        maxWidth: W - M * 2, lineHeight: 16,
      });
    }

    /* ─── RESULTADO page ──────────────────────────────────── */
    if (tasacion.resultadoHtml) {
      const pg = pdf.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });

      pg.drawText("RESULTADO", { x: M, y: H - M - 30, size: 28, font: fontB, color: rgb(0.12, 0.12, 0.12) });
      pg.drawLine({ start: { x: M, y: H - M - 36 }, end: { x: W - M, y: H - M - 36 }, thickness: 1, color: rgb(0.12, 0.12, 0.12) });

      const text = tasacion.resultadoHtml.replace(/<[^>]*>/g, "").trim();
      pg.drawText(text.slice(0, 3000), {
        x: M, y: H - M - 60, size: 12, font: fontR, color: rgb(0.15, 0.15, 0.15),
        maxWidth: W - M * 2, lineHeight: 18,
      });

      drawBranding(pg, fontB, fontR);
    }

    /* ─── LISTA DE PRECIOS page ───────────────────────────── */
    const tablas = Array.isArray(tasacion.tablas) ? (tasacion.tablas as Array<{ titulo: string; filas: Array<{ unidad: string; valor: string; observaciones: string }> }>) : [];

    if (tablas.length > 0) {
      const pg = pdf.addPage([W, H]);
      pg.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });

      // Title bar
      const titulo = asText(tasacion.listaPreciosTitulo, `Lista de Precios - ${direccion}`);
      const titleW = fontB.widthOfTextAtSize(titulo, 14) + 40;
      const titleBarX = (W - titleW) / 2;
      pg.drawRectangle({ x: titleBarX, y: H - M - 30, width: titleW, height: 28, color: rgb(0.25, 0.25, 0.25) });
      pg.drawText(titulo, {
        x: titleBarX + 20,
        y: H - M - 22,
        size: 14, font: fontB, color: rgb(1, 1, 1),
      });

      let ty = H - M - 60;
      const colW = [(W - M * 2) * 0.3, (W - M * 2) * 0.35, (W - M * 2) * 0.35];
      const tableX = M;

      for (const tabla of tablas) {
        if (ty < 150) {
          // Would need a new page - simplified for now
          break;
        }

        // Table header
        const headerH = 36;
        pg.drawRectangle({ x: tableX, y: ty - headerH, width: W - M * 2, height: headerH, color: rgb(1, 1, 1) });
        pg.drawLine({ start: { x: tableX, y: ty }, end: { x: W - M, y: ty }, thickness: 1, color: rgb(0.12, 0.12, 0.12) });
        pg.drawLine({ start: { x: tableX, y: ty - headerH }, end: { x: W - M, y: ty - headerH }, thickness: 1, color: rgb(0.12, 0.12, 0.12) });

        // Column headers
        const headers = [tabla.titulo || "Unidades", "Valor de publicación (USD)", "Observaciones"];
        let cx = tableX;
        for (let ci = 0; ci < 3; ci++) {
          pg.drawText(headers[ci], { x: cx + 8, y: ty - 14, size: 9, font: fontB, color: rgb(0.12, 0.12, 0.12), maxWidth: colW[ci] - 16, lineHeight: 11 });
          if (ci < 2) {
            pg.drawLine({ start: { x: cx + colW[ci], y: ty }, end: { x: cx + colW[ci], y: ty - headerH }, thickness: 0.5, color: rgb(0.12, 0.12, 0.12) });
          }
          cx += colW[ci];
        }

        ty -= headerH;

        // Data rows
        const rowH = 32;
        for (const fila of tabla.filas) {
          pg.drawLine({ start: { x: tableX, y: ty - rowH }, end: { x: W - M, y: ty - rowH }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });

          let rx = tableX;
          const vals = [fila.unidad, fila.valor, fila.observaciones];
          for (let ci = 0; ci < 3; ci++) {
            pg.drawText(asText(vals[ci], ""), { x: rx + 8, y: ty - 18, size: 10, font: fontR, color: rgb(0.2, 0.2, 0.2) });
            if (ci < 2) {
              pg.drawLine({ start: { x: rx + colW[ci], y: ty }, end: { x: rx + colW[ci], y: ty - rowH }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
            }
            rx += colW[ci];
          }
          ty -= rowH;
        }

        // Table bottom border
        pg.drawLine({ start: { x: tableX, y: ty }, end: { x: W - M, y: ty }, thickness: 1, color: rgb(0.12, 0.12, 0.12) });
        // Vertical borders
        pg.drawLine({ start: { x: tableX, y: ty }, end: { x: tableX, y: ty + headerH + tabla.filas.length * rowH }, thickness: 1, color: rgb(0.12, 0.12, 0.12) });
        pg.drawLine({ start: { x: W - M, y: ty }, end: { x: W - M, y: ty + headerH + tabla.filas.length * rowH }, thickness: 1, color: rgb(0.12, 0.12, 0.12) });

        ty -= 24;
      }

      // Disclaimer
      pg.drawText("Los valores expresados son precios de publicación. El precio de cierre puede ser hasta un 3% menor.", {
        x: M, y: ty - 10, size: 9, font: fontR, color: rgb(0.35, 0.35, 0.35),
        maxWidth: W - M * 2, lineHeight: 13,
      });

      // Signature
      pg.drawText("Ante cualquier duda o consulta, estamos a disposición.", { x: M, y: 100, size: 9, font: fontR, color: rgb(0.2, 0.2, 0.2) });
      pg.drawText("Sin mas, saluda atte.", { x: M, y: 86, size: 9, font: fontR, color: rgb(0.2, 0.2, 0.2) });
      pg.drawText("Juliana Agustina Profitos.", { x: M, y: 72, size: 9, font: fontB, color: rgb(0.12, 0.12, 0.12) });
      pg.drawText("COL. 1011", { x: M, y: 58, size: 9, font: fontR, color: rgb(0.2, 0.2, 0.2) });

      drawBranding(pg, fontB, fontR);
    }

    /* ─── MERGE static closing pages ──────────────────────── */
    try {
      const closingPath = path.join(process.cwd(), "public", "pdf", "tasacion-cierre.pdf");
      const closingBytes = await readFile(closingPath);
      const closingPdf = await PDFDocument.load(closingBytes);
      const closingPages = await pdf.copyPages(closingPdf, closingPdf.getPageIndices());
      for (const cp of closingPages) {
        pdf.addPage(cp);
      }
    } catch {
      // No closing PDF found - skip silently
    }

    /* ─── output ──────────────────────────────────────────── */
    const bytes = await pdf.save();
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const safeName = direccion.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, "").replace(/\s+/g, "_").slice(0, 50);
    const fileName = `tasacion_${safeName}_${ts}.pdf`;

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[PDF Tasacion] Error:", error);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  }
}
