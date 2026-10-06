import { prisma } from "@/lib/prisma/client";
import { getDueEffectiveStatus, type RentalDueEffectiveStatus } from "@/lib/rentals";
import { periodLabel } from "@/lib/rentals/collect";
import { adjustmentAlertFor, isoDate, todayISO } from "@/lib/rentals/views";
import type { AdjustmentAlert } from "@/lib/rentals/dto";

/**
 * Datos del portal de inquilinos. Solo lo que le corresponde al inquilino:
 * sus contratos, sus vencimientos, SUS recibos (por cuenta de terceros) y los
 * comprobantes que subió. Nada de honorarios ni del recibo al propietario.
 */

export interface PortalDue {
  id: string;
  dueDate: string;
  period: string; // YYYY-MM
  periodLabel: string;
  status: RentalDueEffectiveStatus;
  amount: number;
  collected: number;
}

export interface PortalReceipt {
  id: string;
  number: string;
  issuedAt: string | null;
  amount: number | null;
  periodLabel: string | null;
}

export interface PortalProof {
  id: string;
  service: string;
  period: string;
  status: "pendiente" | "aprobado" | "rechazado";
  reviewNote: string | null;
  createdAt: string;
}

export interface PortalContract {
  id: string;
  address: string;
  unit: string | null;
  zone: string | null;
  city: string | null;
  currency: string;
  rent: number;
  startDate: string;
  endDate: string;
  dueDay: number | null;
  services: string[];
  adjustment: { everyMonths: number | null; index: string | null; nextDate: string | null; alert: AdjustmentAlert };
  next: PortalDue | null;
  upcoming: PortalDue[];
  history: PortalDue[];
  receipts: PortalReceipt[];
  proofs: PortalProof[];
}

export interface PortalData {
  today: string;
  contracts: PortalContract[];
}

export async function getTenantPortalData(tenantId: string): Promise<PortalData> {
  const today = todayISO();
  const contracts = await prisma.rentalContract.findMany({
    where: { tenantId },
    orderBy: [{ endDate: "desc" }],
    select: {
      id: true,
      unit: true,
      currency: true,
      baseAmount: true,
      startDate: true,
      endDate: true,
      dueDay: true,
      gracePeriodDays: true,
      tenantServices: true,
      adjustmentEveryMonths: true,
      adjustmentIndex: true,
      adjustmentNextDate: true,
      property: { select: { address: true, zone: true, city: true } },
      dueDates: {
        orderBy: { dueDate: "asc" },
        select: { id: true, dueDate: true, status: true, expectedAmount: true, transactions: { select: { amountPaid: true } } },
      },
      receipts: {
        where: { bookKind: "inquilino", status: "emitido" },
        orderBy: { createdAt: "desc" },
        take: 36,
        select: {
          id: true,
          pointOfSale: true,
          number: true,
          issuedAt: true,
          amount: true,
          transaction: { select: { dueDate: { select: { dueDate: true } } } },
        },
      },
      serviceProofs: {
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { id: true, service: true, period: true, status: true, reviewNote: true, createdAt: true },
      },
    },
  });

  return {
    today,
    contracts: contracts.map((c) => {
      const dues: PortalDue[] = c.dueDates.map((d) => {
        const collected = d.transactions.reduce((a, t) => a + t.amountPaid, 0);
        const date = isoDate(d.dueDate);
        return {
          id: d.id,
          dueDate: date,
          period: date.slice(0, 7),
          periodLabel: periodLabel(d.dueDate),
          status: getDueEffectiveStatus({ dueDate: date, status: d.status, gracePeriodDays: c.gracePeriodDays, expectedAmount: d.expectedAmount, collected }),
          amount: d.expectedAmount,
          collected,
        };
      });
      const open = dues.filter((d) => d.status === "esperando" || d.status === "vencido" || d.status === "parcial");
      const next = open[0] ?? null;
      return {
        id: c.id,
        address: c.property.address,
        unit: c.unit,
        zone: c.property.zone,
        city: c.property.city,
        currency: c.currency,
        rent: c.baseAmount,
        startDate: isoDate(c.startDate),
        endDate: isoDate(c.endDate),
        dueDay: c.dueDay,
        services: c.tenantServices,
        adjustment: {
          everyMonths: c.adjustmentEveryMonths,
          index: c.adjustmentIndex,
          nextDate: c.adjustmentNextDate ? isoDate(c.adjustmentNextDate) : null,
          alert: adjustmentAlertFor(c.adjustmentNextDate, today),
        },
        next,
        upcoming: dues.filter((d) => d.dueDate >= today && d.id !== next?.id).slice(0, 5),
        history: dues.filter((d) => d.dueDate < today).reverse().slice(0, 12),
        receipts: c.receipts.map((r) => ({
          id: r.id,
          number: `${String(r.pointOfSale).padStart(4, "0")}-${String(r.number).padStart(8, "0")}`,
          issuedAt: r.issuedAt?.toISOString() ?? null,
          amount: r.amount,
          periodLabel: r.transaction ? periodLabel(r.transaction.dueDate.dueDate) : null,
        })),
        proofs: c.serviceProofs.map((p) => ({
          id: p.id,
          service: p.service,
          period: p.period,
          status: p.status === "aprobado" || p.status === "rechazado" ? p.status : "pendiente",
          reviewNote: p.reviewNote,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    }),
  };
}

/** Marca el último ingreso (como mucho una vez por hora). */
export async function touchPortalLogin(tenantId: string) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.tenant.updateMany({
    where: { id: tenantId, OR: [{ portalLastLoginAt: null }, { portalLastLoginAt: { lt: hourAgo } }] },
    data: { portalLastLoginAt: new Date() },
  });
}
