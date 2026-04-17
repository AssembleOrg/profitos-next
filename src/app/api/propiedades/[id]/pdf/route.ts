import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFImage, StandardFonts, rgb } from "pdf-lib";
import { AppError } from "@/lib/api/handler";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";

function asText(value: string | null | undefined, fallback = "No informado") {
  const text = (value ?? "").trim();
  return text || fallback;
}

function normalizeDescription(value: string | null | undefined) {
  return asText(value, "Sin descripción").replace(/\s+/g, " ");
}

function formatPrice(price: number | null, currency: string | null) {
  if (price === null || Number.isNaN(price)) return "No informado";
  const c = asText(currency, "USD");
  return `${c} ${price.toLocaleString("es-AR")}`;
}

function parsePhotoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const original = typeof obj.original === "string" ? obj.original.trim() : "";
      const image = typeof obj.image === "string" ? obj.image.trim() : "";
      const thumb = typeof obj.thumb === "string" ? obj.thumb.trim() : "";
      return original || image || thumb || null;
    })
    .filter((url): url is string => !!url);
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

async function embedImageLenient(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    try {
      return await pdf.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

async function loadLogoPngBuffer(): Promise<Uint8Array | null> {
  try {
    const logoPath = path.join(process.cwd(), "public", "images", "portada_zona_prop_1.png");
    const buffer = await readFile(logoPath);
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await getAuthContext();
    const url = new URL(request.url);
    const isOwnerMode = url.searchParams.get("mode") === "owner";

    const property = await prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        address: true,
        publicationTitle: true,
        operationType: true,
        operationPrice: true,
        operationCurrency: true,
        city: true,
        type: true,
        status: true,
        roomAmount: true,
        bathroomAmount: true,
        totalSurface: true,
        roofedSurface: true,
        age: true,
        referenceCode: true,
        description: true,
        publicUrl: true,
        coverImageUrl: true,
        photos: true,
        ownerReportData: true,
      },
    });

    if (!property) throw new AppError(404, "Propiedad no encontrada");

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.95, 0.95, 0.96),
    });

    // Header bar (black + thinner)
    const headerHeight = 72;
    page.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width,
      height: headerHeight,
      color: rgb(0.01, 0.01, 0.01),
    });

    const logoPng = await loadLogoPngBuffer();
    if (logoPng) {
      const logoImage = await pdf.embedPng(logoPng);
      const scaled = logoImage.scaleToFit(150, 44);
      page.drawImage(logoImage, {
        x: 28,
        y: height - 58,
        width: scaled.width,
        height: scaled.height,
      });
    } else {
      page.drawText("Juliana Profitos", {
        x: 28,
        y: height - 52,
        size: 24,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      page.drawText("PROPIEDADES", {
        x: 30,
        y: height - 70,
        size: 10,
        font: fontRegular,
        color: rgb(0.75, 0.77, 0.8),
      });
    }

    page.drawText("Ficha de propiedad", {
      x: width - 190,
      y: height - 45,
      size: 12,
      font: fontRegular,
      color: rgb(0.83, 0.85, 0.9),
    });

    // Main title
    const title = asText(property.publicationTitle, property.address).replace(/\s+/g, " ").trim();
    const titleSize = 22;
    const titleLineHeight = 28;
    const titleMaxWidth = width - 56;
    const titleMeasure = fontBold.widthOfTextAtSize(title, titleSize);
    const titleLines = Math.max(1, Math.ceil(titleMeasure / titleMaxWidth));
    const titleTopY = height - (headerHeight + 42);
    page.drawText(title, {
      x: 28,
      y: titleTopY,
      size: titleSize,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.14),
      maxWidth: titleMaxWidth,
      lineHeight: titleLineHeight,
    });

    // Operation + price card (positioned below title to avoid overlap)
    const cardX = 28;
    const cardY = titleTopY - titleLines * titleLineHeight - 18 - 72;
    const cardW = 240;
    const cardH = 72;
    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      color: rgb(1, 1, 1),
    });
    page.drawRectangle({
      x: cardX,
      y: cardY + cardH - 28,
      width: cardW,
      height: 28,
      color: rgb(0.86, 0.28, 0.2),
    });
    page.drawText(asText(property.operationType, "Operación").toUpperCase(), {
      x: cardX + 12,
      y: cardY + cardH - 18,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(formatPrice(property.operationPrice, property.operationCurrency), {
      x: cardX + 12,
      y: cardY + 18,
      size: 18,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.14),
    });

    // Media + details split
    const mediaX = 28;
    const mediaY = height - 545;
    const mediaW = 360;
    const mediaH = 280;
    const panelX = 402;
    const panelY = mediaY + mediaH;
    const panelW = width - panelX - 20;

    page.drawRectangle({
      x: mediaX,
      y: mediaY,
      width: mediaW,
      height: mediaH,
      color: rgb(0.92, 0.93, 0.95),
    });

    const photoUrls = [
      ...parsePhotoUrls(property.photos),
      ...(property.coverImageUrl ? [property.coverImageUrl] : []),
    ];
    const uniqueUrls = Array.from(new Set(photoUrls));
    const firstImageUrl = uniqueUrls[0] ?? null;

    let imageDrawn = false;
    if (firstImageUrl) {
      const bytes = await fetchImageBytes(firstImageUrl);
      if (bytes) {
        const image = await embedImageLenient(pdf, bytes);
        if (image) {
          const scaled = image.scaleToFit(mediaW, mediaH);
          page.drawImage(image, {
            x: mediaX + (mediaW - scaled.width) / 2,
            y: mediaY + (mediaH - scaled.height) / 2,
            width: scaled.width,
            height: scaled.height,
          });
          imageDrawn = true;
        }
      }
    }
    if (!imageDrawn) {
      page.drawText("Sin imagen disponible", {
        x: mediaX + 112,
        y: mediaY + mediaH / 2,
        size: 12,
        font: fontRegular,
        color: rgb(0.35, 0.37, 0.4),
      });
    }

    // Details panel
    page.drawRectangle({
      x: panelX,
      y: panelY - 26,
      width: panelW,
      height: 26,
      color: rgb(0.74, 0.76, 0.79),
    });
    page.drawText("DETALLES", {
      x: panelX + 10,
      y: panelY - 17,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const details: Array<[string, string]> = [
      ["Dirección", asText(property.address)],
      ["Ubicación", asText(property.city)],
      ["Tipo", asText(property.type)],
      ["Estado", asText(property.status)],
      ["Dormitorios", property.roomAmount !== null ? String(property.roomAmount) : "No informado"],
      ["Baños", property.bathroomAmount !== null ? String(property.bathroomAmount) : "No informado"],
      ["Sup. total", property.totalSurface !== null ? `${property.totalSurface} m2` : "No informado"],
      ["Sup. cubierta", property.roofedSurface !== null ? `${property.roofedSurface} m2` : "No informado"],
      ["Antigüedad", property.age !== null ? `${property.age} años` : "No informado"],
      ["Ref", asText(property.referenceCode)],
    ];

    let dy = panelY - 44;
    for (const [label, value] of details) {
      page.drawText(label, {
        x: panelX + 10,
        y: dy,
        size: 10,
        font: fontBold,
        color: rgb(0.1, 0.11, 0.13),
      });
      page.drawText(value, {
        x: panelX + 10,
        y: dy - 13,
        size: 10,
        font: fontRegular,
        color: rgb(0.2, 0.22, 0.25),
        maxWidth: panelW - 16,
      });
      dy -= 30;
    }

    // Description block
    const descY = 220;
    page.drawRectangle({
      x: 28,
      y: descY - 8,
      width: width - 56,
      height: 18,
      color: rgb(0.9, 0.91, 0.93),
    });
    page.drawText("DESCRIPCIÓN", {
      x: 36,
      y: descY - 1,
      size: 10,
      font: fontBold,
      color: rgb(0.12, 0.13, 0.16),
    });

    const desc = normalizeDescription(property.description).slice(0, 820);
    page.drawText(desc, {
      x: 32,
      y: descY - 26,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.22, 0.25),
      maxWidth: width - 64,
      lineHeight: 14,
    });

    // Owner report section (only in owner mode)
    if (isOwnerMode) {
      const ownerData = (property.ownerReportData ?? {}) as Record<string, unknown>;
      const visitasTotales = ownerData.visitasTotales ?? "—";
      const visitasMes = ownerData.visitasMes ?? "—";
      const quejas = ((ownerData.quejas as string) ?? "").trim() || "Sin quejas registradas";
      const mejoras = ((ownerData.mejoras as string) ?? "").trim() || "Sin mejoras registradas";

      // Add a second page for the owner report
      const page2 = pdf.addPage([595, 842]);
      const p2W = 595;
      const p2H = 842;
      let p2Y = p2H - 36;

      // Header stripe
      page2.drawRectangle({ x: 0, y: p2H - 56, width: p2W, height: 56, color: rgb(0.01, 0.01, 0.01) });
      page2.drawText("INFORME PARA PROPIETARIO", { x: 28, y: p2H - 38, size: 16, font: fontBold, color: rgb(1, 1, 1) });
      page2.drawText(asText(property.address), { x: 28, y: p2H - 52, size: 9, font: fontRegular, color: rgb(0.7, 0.72, 0.75) });
      p2Y = p2H - 56 - 28;

      // Visitas cards
      const vCardW = 240;
      const vCardH = 60;
      // Card 1: Visitas totales
      page2.drawRectangle({ x: 28, y: p2Y - vCardH, width: vCardW, height: vCardH, color: rgb(1, 1, 1) });
      page2.drawText("VISITAS TOTALES", { x: 40, y: p2Y - 20, size: 9, font: fontBold, color: rgb(0.4, 0.42, 0.45) });
      page2.drawText(String(visitasTotales), { x: 40, y: p2Y - 44, size: 24, font: fontBold, color: rgb(0.08, 0.1, 0.14) });

      // Card 2: Visitas este mes
      page2.drawRectangle({ x: 28 + vCardW + 16, y: p2Y - vCardH, width: vCardW, height: vCardH, color: rgb(1, 1, 1) });
      page2.drawText("VISITAS ESTE MES", { x: 28 + vCardW + 28, y: p2Y - 20, size: 9, font: fontBold, color: rgb(0.4, 0.42, 0.45) });
      page2.drawText(String(visitasMes), { x: 28 + vCardW + 28, y: p2Y - 44, size: 24, font: fontBold, color: rgb(0.08, 0.1, 0.14) });

      p2Y -= vCardH + 28;

      // Quejas section
      page2.drawRectangle({ x: 28, y: p2Y - 18, width: p2W - 56, height: 22, color: rgb(0.9, 0.91, 0.93) });
      page2.drawText("QUEJAS / OBSERVACIONES", { x: 36, y: p2Y - 12, size: 10, font: fontBold, color: rgb(0.12, 0.13, 0.16) });
      p2Y -= 36;

      page2.drawText(quejas.slice(0, 1200), {
        x: 32, y: p2Y, size: 10, font: fontRegular, color: rgb(0.2, 0.22, 0.25),
        maxWidth: p2W - 64, lineHeight: 14,
      });

      const quejasLines = Math.max(1, Math.ceil(fontRegular.widthOfTextAtSize(quejas.slice(0, 1200), 10) / (p2W - 64)));
      p2Y -= quejasLines * 14 + 24;

      // Mejoras section
      page2.drawRectangle({ x: 28, y: p2Y - 18, width: p2W - 56, height: 22, color: rgb(0.9, 0.91, 0.93) });
      page2.drawText("MEJORAS / SUGERENCIAS", { x: 36, y: p2Y - 12, size: 10, font: fontBold, color: rgb(0.12, 0.13, 0.16) });
      p2Y -= 36;

      page2.drawText(mejoras.slice(0, 1200), {
        x: 32, y: p2Y, size: 10, font: fontRegular, color: rgb(0.2, 0.22, 0.25),
        maxWidth: p2W - 64, lineHeight: 14,
      });

      // Page 2 footer
      page2.drawLine({ start: { x: 28, y: 56 }, end: { x: p2W - 28, y: 56 }, thickness: 0.8, color: rgb(0.8, 0.82, 0.85) });
      page2.drawText(`Generado: ${new Date().toLocaleString("es-AR", { hour12: false })}`, {
        x: 30, y: 40, size: 9, font: fontRegular, color: rgb(0.35, 0.37, 0.4),
      });
      page2.drawText("Informe confidencial para el propietario", {
        x: 30, y: 26, size: 9, font: fontRegular, color: rgb(0.35, 0.37, 0.4),
      });
    }

    // Footer
    page.drawLine({
      start: { x: 28, y: 56 },
      end: { x: width - 28, y: 56 },
      thickness: 0.8,
      color: rgb(0.8, 0.82, 0.85),
    });
    page.drawText(`Generado: ${new Date().toLocaleString("es-AR", { hour12: false })}`, {
      x: 30,
      y: 40,
      size: 9,
      font: fontRegular,
      color: rgb(0.35, 0.37, 0.4),
    });
    if (property.publicUrl) {
      page.drawText(`Publicación en Tokko: ${property.publicUrl}`, {
        x: 30,
        y: 26,
        size: 9,
        font: fontRegular,
        color: rgb(0.2, 0.4, 0.68),
        maxWidth: width - 60,
      });
    }

    const bytes = await pdf.save();
    const fileNameBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const prefix = isOwnerMode ? "informe-propietario" : "propiedad";
    const fileName = `${prefix}-${fileNameBase || property.id}-${ts}.pdf`;

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { statusCode: error.statusCode, data: null, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("[PDF Property] Error:", error);
    return Response.json(
      { statusCode: 500, data: null, message: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
