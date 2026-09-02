import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { prisma } from "@/lib/prisma/client";
import { assertChatToolsAuth, requireChatRequester, siteUrl } from "@/lib/api/chat-tools";
import { resolveProperty } from "@/lib/chat/resolve-property";
import { registerRentalPayment } from "@/lib/rentals/register-payment";
import { getDueEffectiveStatus } from "@/lib/rentals";

// Tool del chat IA: REGISTRAR UN PAGO de alquiler (genera el recibo PDF con
// número correlativo, igual que desde la web). Requiere confirmación en el chat.
// La cuota se identifica por dueDateId (de ver_alquileres vista=vencimientos)
// o por propiedad + mes (YYYY-MM); sin mes, la cuota impaga más vieja.
export const POST = withHandler(async (request: NextRequest) => {
  assertChatToolsAuth(request);
  const who = await requireChatRequester(request);
  const body = (await request.json().catch(() => ({}))) as {
    dueDateId?: string;
    propertyId?: string;
    referencia?: string;
    direccion?: string;
    mes?: string;
    monto?: number | string;
    comision?: number | string;
    metodo?: string;
    total?: boolean;
    notas?: string;
    fechaPago?: string;
  };

  const num = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };
  const monto = num(body.monto);
  if (monto === undefined || monto < 0) throw new AppError(400, "Falta el monto cobrado (número)");
  const comision = num(body.comision) ?? 0;

  let dueDateId = body.dueDateId?.trim();
  let etiqueta = "";
  if (!dueDateId) {
    const prop = await resolveProperty(body);
    const contratos = await prisma.rentalContract.findMany({
      where: { propertyId: prop.id, endDate: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      select: { id: true, gracePeriodDays: true, tenant: { select: { fullName: true } } },
      orderBy: { endDate: "desc" },
    });
    if (!contratos.length) throw new AppError(404, `${prop.direccion} no tiene contrato de alquiler vigente`);
    const contrato = contratos[0];
    const dues = await prisma.rentalDueDate.findMany({
      where: { contractId: contrato.id },
      select: { id: true, position: true, dueDate: true, expectedAmount: true, status: true, transactions: { select: { amountPaid: true } } },
      orderBy: { dueDate: "asc" },
    });
    const impagas = dues.filter((d) => {
      const cobrado = d.transactions.reduce((a, t) => a + t.amountPaid, 0);
      const st = getDueEffectiveStatus({ dueDate: d.dueDate, status: d.status, gracePeriodDays: contrato.gracePeriodDays, expectedAmount: d.expectedAmount, collected: cobrado });
      return st !== "pagado" && st !== "condonado";
    });
    const mes = (body.mes ?? "").trim();
    const elegida = mes ? impagas.find((d) => d.dueDate.toISOString().slice(0, 7) === mes) : impagas[0];
    if (!elegida) {
      const lista = impagas.slice(0, 6).map((d) => `cuota ${d.position} vence ${d.dueDate.toISOString().slice(0, 10)} [dueDateId ${d.id}]`).join("; ");
      throw new AppError(404, mes ? `No hay cuota impaga de ${mes} para ${prop.direccion}. Impagas: ${lista || "ninguna"}` : `${prop.direccion} no tiene cuotas impagas.`);
    }
    dueDateId = elegida.id;
    etiqueta = `${prop.direccion} · ${contrato.tenant.fullName} · cuota ${elegida.position} (${elegida.dueDate.toISOString().slice(0, 10)})`;
  }

  let paidAt: Date | null = null;
  if (body.fechaPago?.trim()) {
    paidAt = new Date(`${body.fechaPago.trim()}T12:00:00`);
    if (Number.isNaN(paidAt.getTime())) throw new AppError(400, "fechaPago inválida (YYYY-MM-DD)");
  }

  const r = await registerRentalPayment({
    dueDateId,
    amountPaid: monto,
    commissionAmount: comision,
    method: body.metodo,
    paidAt,
    isFull: body.total !== false,
    notes: body.notas,
    userId: who.userId,
  });
  if (!etiqueta) etiqueta = `${r.due.contract.property.address} · ${r.due.contract.tenant.fullName} · cuota ${r.due.position}`;
  console.log(`[chat-tools] ${who.email} registró pago recibo #${r.receiptNumber} (${etiqueta})`);

  return created(
    {
      recibo: r.receiptNumber,
      cuota: etiqueta,
      monto,
      comision,
      estadoCuota: r.nextStatus,
      reciboGenerado: Boolean(r.receiptPath),
      alquileresUrl: `${siteUrl()}/alquileres`,
      nota: "El recibo PDF se descarga desde Alquileres → cuota → pagos.",
    },
    `Pago registrado (recibo #${r.receiptNumber}) para ${etiqueta}; cuota ${r.nextStatus}.`,
    request.nextUrl.pathname
  );
});
