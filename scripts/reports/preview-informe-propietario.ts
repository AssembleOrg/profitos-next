/**
 * Vista previa de las hojas del "Informe para propietario" (sin la ficha ni los
 * gastos) con datos reales, para revisar el diseño sin pasar por la web.
 *
 *   node --import tsx scripts/reports/preview-informe-propietario.ts <propertyId> salida.pdf ["quejas"] ["mejoras"]
 *   pdftoppm -png -r 80 salida.pdf salida   # para verla como imagen
 *
 * Sólo LEE la base (ojo: .env apunta a producción).
 */
import "dotenv/config";
import fs from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma/client";
import { now } from "@/lib/datetime";
import { getOwnerReportStats } from "@/lib/reports/owner-stats";
import { addOwnerReportPages } from "@/lib/reports/owner-report-pdf";
(async () => {
  const [id, out, quejas, mejoras] = process.argv.slice(2);
  const p = await prisma.property.findUniqueOrThrow({ where: { id }, select: { id: true, address: true, referenceCode: true } });
  const stats = await getOwnerReportStats(p.id, p.referenceCode);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  addOwnerReportPages(pdf, { regular, bold }, { address: p.address, stats, quejas: quejas ?? "", mejoras: mejoras ?? "", generatedAt: now() });
  fs.writeFileSync(out, await pdf.save());
  process.exit(0);
})();
