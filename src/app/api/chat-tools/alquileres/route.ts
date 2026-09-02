import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, siteUrl } from "@/lib/api/chat-tools";
import { getDueEffectiveStatus } from "@/lib/rentals";

// Tool del chat IA: ADMINISTRACIÓN DE ALQUILERES (solo lectura).
//  vista=contratos     → contratos vigentes que vencen en los próximos `dias` (default 60)
//  vista=vencimientos  → cuotas vencidas / a vencer en los próximos `dias` (default 30)
//  vista=cobros        → pagos registrados en el mes (default: mes actual, o mes=YYYY-MM)
const VISTAS = ["contratos", "vencimientos", "cobros"] as const;

function fmt(n: number, cur = "ARS"): string {
  return `${cur} ${Math.round(n).toLocaleString("es-AR")}`;
}

export const GET = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const sp = request.nextUrl.searchParams;
  const vista = (sp.get("vista") ?? "vencimientos").trim().toLowerCase();
  if (!(VISTAS as readonly string[]).includes(vista)) throw new AppError(400, `vista inválida: ${vista} (${VISTAS.join(", ")})`);
  const path = request.nextUrl.pathname;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const url = `${siteUrl()}/alquileres`;

  if (vista === "contratos") {
    const dias = Math.max(1, Number.parseInt(sp.get("dias") ?? "60", 10) || 60);
    const hasta = new Date(today);
    hasta.setDate(hasta.getDate() + dias);
    const rows = await prisma.rentalContract.findMany({
      where: { endDate: { gte: today, lte: hasta } },
      select: {
        id: true,
        title: true,
        endDate: true,
        baseAmount: true,
        currency: true,
        frequency: true,
        property: { select: { address: true } },
        tenant: { select: { fullName: true, phone: true } },
      },
      orderBy: { endDate: "asc" },
      take: 40,
    });
    const vigentes = await prisma.rentalContract.count({ where: { endDate: { gte: today } } });
    return ok(
      {
        contratosVigentes: vigentes,
        vencenEnDias: dias,
        cantidad: rows.length,
        contratos: rows.map((c) => ({
          propiedad: c.property.address,
          inquilino: `${c.tenant.fullName}${c.tenant.phone ? ` (${c.tenant.phone})` : ""}`,
          vence: c.endDate.toISOString().slice(0, 10),
          diasRestantes: Math.ceil((c.endDate.getTime() - today.getTime()) / 86_400_000),
          monto: fmt(c.baseAmount, c.currency),
          frecuencia: c.frequency,
        })),
        alquileresUrl: url,
      },
      "Contratos por vencer",
      path
    );
  }

  if (vista === "vencimientos") {
    const dias = Math.max(1, Number.parseInt(sp.get("dias") ?? "30", 10) || 30);
    const hasta = new Date(today);
    hasta.setDate(hasta.getDate() + dias);
    const desde = new Date(today);
    desde.setDate(desde.getDate() - 400); // vencidas viejas también
    const rows = await prisma.rentalDueDate.findMany({
      where: { dueDate: { gte: desde, lte: hasta } },
      select: {
        id: true,
        position: true,
        dueDate: true,
        expectedAmount: true,
        status: true,
        transactions: { select: { amountPaid: true } },
        contract: {
          select: { gracePeriodDays: true, currency: true, property: { select: { address: true } }, tenant: { select: { fullName: true, phone: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    });
    const items = rows
      .map((d) => {
        const cobrado = d.transactions.reduce((a, t) => a + t.amountPaid, 0);
        const estado = getDueEffectiveStatus({
          dueDate: d.dueDate,
          status: d.status,
          gracePeriodDays: d.contract.gracePeriodDays,
          expectedAmount: d.expectedAmount,
          collected: cobrado,
        });
        return {
          dueDateId: d.id,
          propiedad: d.contract.property.address,
          inquilino: `${d.contract.tenant.fullName}${d.contract.tenant.phone ? ` (${d.contract.tenant.phone})` : ""}`,
          cuota: d.position,
          vence: d.dueDate.toISOString().slice(0, 10),
          esperado: fmt(d.expectedAmount, d.contract.currency),
          cobrado: cobrado ? fmt(cobrado, d.contract.currency) : null,
          estado,
        };
      })
      .filter((x) => x.estado === "vencido" || x.estado === "parcial" || x.estado === "esperando");
    const vencidas = items.filter((x) => x.estado === "vencido");
    return ok(
      {
        proximosDias: dias,
        vencidas: vencidas.length,
        parciales: items.filter((x) => x.estado === "parcial").length,
        aVencer: items.filter((x) => x.estado === "esperando").length,
        cuotas: items.slice(0, 40),
        alquileresUrl: url,
      },
      "Vencimientos de alquiler",
      path
    );
  }

  // cobros del mes
  const mes = (sp.get("mes") ?? "").trim();
  const base = /^\d{4}-\d{2}$/.test(mes) ? new Date(`${mes}-01T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), 1);
  const fin = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  const pagos = await prisma.rentalPaymentTransaction.findMany({
    where: { paidAt: { gte: base, lte: fin } },
    select: {
      amountPaid: true,
      commissionAmount: true,
      ownerAmount: true,
      paidAt: true,
      receiptNumber: true,
      method: true,
      dueDate: { select: { position: true, contract: { select: { currency: true, property: { select: { address: true } }, tenant: { select: { fullName: true } } } } } },
    },
    orderBy: { paidAt: "desc" },
    take: 60,
  });
  const total = pagos.reduce((a, p) => a + p.amountPaid, 0);
  const comision = pagos.reduce((a, p) => a + p.commissionAmount, 0);
  return ok(
    {
      mes: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`,
      cantidad: pagos.length,
      totalCobrado: fmt(total),
      comisionInmobiliaria: fmt(comision),
      netoPropietarios: fmt(total - comision),
      pagos: pagos.map((p) => ({
        fecha: p.paidAt.toISOString().slice(0, 10),
        propiedad: p.dueDate.contract.property.address,
        inquilino: p.dueDate.contract.tenant.fullName,
        cuota: p.dueDate.position,
        monto: fmt(p.amountPaid, p.dueDate.contract.currency),
        recibo: p.receiptNumber,
        metodo: p.method,
      })),
      alquileresUrl: url,
    },
    "Cobros del mes",
    path
  );
});
