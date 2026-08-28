import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { now, fromISO, formatDateOnly } from "@/lib/datetime";

/* ── helpers ─────────────────────────────────────────────────── */

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  // Fechas de almanaque (vencimiento, fecha de visita) → día calendario en GMT-3.
  return formatDateOnly(d);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── colors ──────────────────────────────────────────────────── */

const C = {
  bg: rgb(0.05, 0.06, 0.07),
  surface: rgb(0.09, 0.10, 0.12),
  surfaceElevated: rgb(0.12, 0.14, 0.16),
  accent: rgb(0.42, 0.48, 0.36),
  accentBright: rgb(0.56, 0.66, 0.44),
  text: rgb(0.94, 0.93, 0.91),
  textMuted: rgb(0.62, 0.60, 0.58),
  textFaint: rgb(0.42, 0.40, 0.38),
  white: rgb(1, 1, 1),
  green: rgb(0.20, 0.78, 0.45),
  amber: rgb(0.96, 0.66, 0.14),
  red: rgb(0.90, 0.30, 0.30),
  sky: rgb(0.22, 0.64, 0.92),
  divider: rgb(0.16, 0.18, 0.20),
};

/* ── route ───────────────────────────────────────────────────── */

export async function GET(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  try {
  const { isAdmin } = await getAuthContext();
  if (!isAdmin) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const { id } = await context.params;
  const sp = request.nextUrl.searchParams;

  const whitelist = await prisma.whitelist.findUnique({ where: { id } });
  if (!whitelist) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

  const user = await prisma.user.findFirst({
    where: { email: { equals: whitelist.email, mode: "insensitive" } },
    select: { id: true, email: true, fullName: true, role: true },
  });
  if (!user) return NextResponse.json({ error: "Sin cuenta" }, { status: 400 });

  const fromDt = sp.get("from") ? fromISO(sp.get("from")!).startOf("day") : now().startOf("month");
  const toDt = sp.get("to") ? fromISO(sp.get("to")!).endOf("day") : now().endOf("day");
  const from = fromDt.toJSDate();
  const to = toDt.toJSDate();

  const dateRange = { gte: from, lte: to };
  const userId = user.id;

  // ── fetch data ──
  const [
    segPropAsignados, segPropCompletados, segPropVencidos,
    visitasRealizadas, clientesCreados,
    accionesSeg,
    segPropPorEstadoRaw,
    accionesPorTipoRaw,
    seguimientosProp, visitas,
  ] = await Promise.all([
    prisma.propertyFollowUp.count({ where: { assignedToUserId: userId, createdAt: dateRange } }),
    prisma.propertyFollowUp.count({ where: { assignedToUserId: userId, status: "hecho", updatedAt: dateRange } }),
    prisma.propertyFollowUp.count({ where: { assignedToUserId: userId, status: { notIn: ["hecho", "cancelado"] }, dueDate: { lt: new Date() } } }),
    prisma.visit.count({ where: { userId, date: dateRange } }),
    prisma.client.count({ where: { userId, createdAt: dateRange } }),
    prisma.followUpAction.count({ where: { createdByUserId: userId, createdAt: dateRange } }),
    prisma.propertyFollowUp.groupBy({ by: ["status"], where: { assignedToUserId: userId, createdAt: dateRange }, _count: { _all: true } }),
    prisma.followUpAction.groupBy({ by: ["type"], where: { createdByUserId: userId, createdAt: dateRange }, _count: { _all: true } }),
    prisma.propertyFollowUp.findMany({
      where: { assignedToUserId: userId, createdAt: dateRange }, orderBy: { createdAt: "desc" }, take: 25,
      select: { title: true, status: true, dueDate: true, property: { select: { address: true } }, _count: { select: { actions: true } } },
    }),
    prisma.visit.findMany({
      where: { userId, date: dateRange }, orderBy: { date: "desc" }, take: 25,
      select: { title: true, date: true, startTime: true, endTime: true, property: { select: { address: true } }, client: { select: { name: true } } },
    }),
  ]);

  // ── computed ──
  const totalAcciones = accionesSeg;
  const dias = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  const tasaResolucion = segPropAsignados > 0 ? Math.round((segPropCompletados / segPropAsignados) * 100) : null;
  const actPorDia = Math.round((totalAcciones / dias) * 10) / 10;
  const nivel = actPorDia >= 3 ? "ALTO" : actPorDia >= 1 ? "MODERADO" : "BAJO";
  const nivelColor = actPorDia >= 3 ? C.green : actPorDia >= 1 ? C.amber : C.red;

  const segPropEstado: Record<string, number> = {};
  for (const r of segPropPorEstadoRaw) segPropEstado[r.status] = r._count._all;
  const accTipo: Record<string, number> = {};
  for (const r of accionesPorTipoRaw) accTipo[r.type] = (accTipo[r.type] ?? 0) + r._count._all;

  // ── build PDF ──
  const pdf = await PDFDocument.create();
  const fontR = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595;
  const H = 842;
  const M = 36; // margin
  const CW = W - M * 2; // content width

  let page = pdf.addPage([W, H]);
  let y = H - M;

  function newPageIfNeeded(need: number) {
    if (y - need < M + 20) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  }

  function drawSectionTitle(title: string) {
    newPageIfNeeded(40);
    y -= 28;
    page.drawRectangle({ x: M, y: y - 2, width: CW, height: 22, color: C.surfaceElevated });
    page.drawText(title.toUpperCase(), { x: M + 10, y: y + 3, size: 8, font: fontB, color: C.accentBright });
    y -= 16;
  }

  function drawRow(label: string, value: string, indent = 0) {
    newPageIfNeeded(16);
    y -= 15;
    page.drawText(label, { x: M + 10 + indent, y, size: 8.5, font: fontR, color: C.textMuted });
    page.drawText(value, { x: W - M - 10 - fontR.widthOfTextAtSize(value, 8.5), y, size: 8.5, font: fontB, color: C.text });
  }

  function drawDivider() {
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: C.divider });
    y -= 4;
  }

  // ── PAGE 1: Header ──
  // Full-width dark header bar
  const headerH = 80;
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: C.surface });
  page.drawRectangle({ x: 0, y: H - headerH, width: 4, height: headerH, color: C.accentBright }); // accent stripe

  page.drawText("INFORME DE RENDIMIENTO", { x: M + 8, y: H - 32, size: 16, font: fontB, color: C.text });
  page.drawText(user.fullName ?? user.email, { x: M + 8, y: H - 50, size: 10, font: fontR, color: C.textMuted });
  page.drawText(`${user.email}  ·  ${capitalize(user.role)}`, { x: M + 8, y: H - 64, size: 8, font: fontR, color: C.textFaint });

  // Date range badge on right
  const dateStr = `${fromDt.toFormat("dd/MM/yyyy")}  —  ${toDt.toFormat("dd/MM/yyyy")}`;
  const dateW = fontR.widthOfTextAtSize(dateStr, 8) + 16;
  page.drawRectangle({ x: W - M - dateW, y: H - 52, width: dateW, height: 18, color: C.surfaceElevated });
  page.drawText(dateStr, { x: W - M - dateW + 8, y: H - 47, size: 8, font: fontR, color: C.textMuted });

  y = H - headerH - 20;

  // ── Resumen ejecutivo ──
  const resumenH = 70;
  page.drawRectangle({ x: M, y: y - resumenH, width: CW, height: resumenH, color: C.surface });
  page.drawRectangle({ x: M, y: y - resumenH, width: CW, height: 3, color: nivelColor }); // bottom accent

  // Level badge
  const badgeW = fontB.widthOfTextAtSize(nivel, 9) + 16;
  page.drawRectangle({ x: M + 12, y: y - 22, width: badgeW, height: 16, color: nivelColor });
  page.drawText(nivel, { x: M + 20, y: y - 18, size: 9, font: fontB, color: C.bg });

  page.drawText("Actividad general del período", { x: M + 12 + badgeW + 8, y: y - 18, size: 8, font: fontR, color: C.textFaint });

  // KPI row inside resumen
  const kpiY = y - resumenH + 18;
  const kpis = [
    { label: "Tasa resolución", value: tasaResolucion !== null ? `${tasaResolucion}%` : "—" },
    { label: "Acciones/día", value: String(actPorDia) },
    { label: "Acciones total", value: String(totalAcciones) },
    { label: "Vencidos", value: String(segPropVencidos) },
  ];
  const kpiSpacing = CW / kpis.length;
  kpis.forEach((k, i) => {
    const kx = M + i * kpiSpacing + 12;
    page.drawText(k.value, { x: kx, y: kpiY + 14, size: 14, font: fontB, color: C.text });
    page.drawText(k.label, { x: kx, y: kpiY, size: 7, font: fontR, color: C.textFaint });
  });

  y -= resumenH + 16;

  // ── KPIs detallados ──
  drawSectionTitle("Indicadores del período");
  drawRow("Seg. propiedades asignados", String(segPropAsignados));
  drawRow("Seg. propiedades completados", String(segPropCompletados));
  drawRow("Visitas realizadas", String(visitasRealizadas));
  drawRow("Clientes creados", String(clientesCreados));
  drawRow("Acciones realizadas", String(totalAcciones));

  // ── Breakdown: seg. propiedades por estado ──
  if (Object.keys(segPropEstado).length > 0) {
    drawDivider();
    drawSectionTitle("Seg. propiedades por estado");
    for (const [status, count] of Object.entries(segPropEstado)) {
      drawRow(capitalize(status), String(count));
    }
  }

  // ── Breakdown: acciones por tipo ──
  if (Object.keys(accTipo).length > 0) {
    drawDivider();
    drawSectionTitle("Acciones por tipo");
    for (const [type, count] of Object.entries(accTipo)) {
      drawRow(capitalize(type), String(count));
    }
  }

  // ── Seguimientos de propiedades ──
  if (seguimientosProp.length > 0) {
    drawDivider();
    drawSectionTitle(`Seg. propiedades (${seguimientosProp.length})`);
    for (const s of seguimientosProp) {
      newPageIfNeeded(28);
      y -= 14;
      const addr = truncate(s.property?.address ?? "Sin dirección", 45);
      page.drawText(addr, { x: M + 10, y, size: 8.5, font: fontB, color: C.text });
      const meta = `${s._count.actions} acc.  ·  ${capitalize(s.status)}${s.dueDate ? `  ·  Vence: ${fmtDate(s.dueDate)}` : ""}`;
      y -= 11;
      page.drawText(meta, { x: M + 10, y, size: 7, font: fontR, color: C.textFaint });
    }
  }

  // ── Visitas ──
  if (visitas.length > 0) {
    drawDivider();
    drawSectionTitle(`Visitas (${visitas.length})`);
    for (const v of visitas) {
      newPageIfNeeded(16);
      y -= 14;
      const title = truncate(v.title, 35);
      const prop = v.property?.address ? truncate(v.property.address, 30) : "";
      const detail = `${fmtDate(v.date)}  ${v.startTime}-${v.endTime}${prop ? `  ·  ${prop}` : ""}`;
      page.drawText(title, { x: M + 10, y, size: 8.5, font: fontB, color: C.text });
      y -= 11;
      page.drawText(detail, { x: M + 10, y, size: 7, font: fontR, color: C.textFaint });
    }
  }

  // ── Footer on every page ──
  const pages = pdf.getPages();
  const totalPages = pages.length;
  const generadoStr = now().toFormat("dd/MM/yyyy");
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    const footerY = 16;
    p.drawLine({ start: { x: M, y: footerY + 10 }, end: { x: W - M, y: footerY + 10 }, thickness: 0.5, color: C.divider });
    p.drawText("Profitos Propiedades", { x: M, y: footerY, size: 7, font: fontR, color: C.textFaint });
    p.drawText(`Generado: ${generadoStr}`, { x: W / 2 - 30, y: footerY, size: 7, font: fontR, color: C.textFaint });
    const pageLabel = `${i + 1} / ${totalPages}`;
    p.drawText(pageLabel, { x: W - M - fontR.widthOfTextAtSize(pageLabel, 7), y: footerY, size: 7, font: fontR, color: C.textFaint });
  }

  // ── output ──
  const bytes = await pdf.save();
  const safeName = (user.fullName ?? user.email).replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `informe_${safeName}_${fromDt.toFormat("dd-MM-yyyy")}_${toDt.toFormat("dd-MM-yyyy")}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
  } catch (err) {
    console.error("[PDF Error]", err);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  }
}
