import { AppError } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { isCurrency, RENTAL_COMMISSION_CATEGORY_ID } from "./index";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface EntryBody {
  categoryId?: string;
  amount?: number;
  currency?: string;
  date?: string;
  description?: string;
  agentUserId?: string | null;
  propertyId?: string | null;
  /** Valor informativo dado al agente (solo egresos): % o monto fijo. */
  agentPercentage?: number | null;
  /** "percent" | "amount" — cómo interpretar agentPercentage. */
  agentShareType?: string;
  /** Marca informativa: ¿movimiento compartido? */
  isShared?: boolean;
  attachments?: unknown[];
}

export interface ValidatedEntry {
  type: "income" | "expense";
  categoryId: string;
  amount: number;
  currency: "ARS" | "USD";
  date: Date;
  description: string | null;
  agentUserId: string | null;
  propertyId: string | null;
  agentPercentage: number | null;
  agentShareType: "percent" | "amount";
  isShared: boolean;
  attachments: Prisma.InputJsonValue | undefined;
}

/**
 * Valida y normaliza el payload de un movimiento manual.
 * `type` se deriva del `kind` de la categoría (fuente de verdad).
 */
export async function validateEntry(body: EntryBody): Promise<ValidatedEntry> {
  const { categoryId, amount, currency, date, description, agentUserId, propertyId, agentPercentage, agentShareType, isShared, attachments } = body;

  if (!categoryId) throw new AppError(400, "La categoría es obligatoria");
  if (categoryId === RENTAL_COMMISSION_CATEGORY_ID) {
    throw new AppError(400, "Las comisiones de alquiler se cargan desde los pagos, no manualmente");
  }
  const category = await prisma.accountCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(400, "La categoría no existe");
  if (category.archivedAt) throw new AppError(400, "La categoría está archivada");

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, "El monto debe ser mayor a cero");
  }

  const cur = currency ?? "ARS";
  if (!isCurrency(cur)) throw new AppError(400, "Moneda inválida (ARS/USD)");

  if (!date || !DATE_RE.test(date)) throw new AppError(400, "Fecha inválida (formato YYYY-MM-DD)");

  if (agentUserId) {
    const exists = await prisma.user.count({ where: { id: agentUserId } });
    if (!exists) throw new AppError(400, "El agente seleccionado no existe");
  }
  if (propertyId) {
    const exists = await prisma.property.count({ where: { id: propertyId } });
    if (!exists) throw new AppError(400, "La propiedad seleccionada no existe");
  }
  if (attachments !== undefined && !Array.isArray(attachments)) {
    throw new AppError(400, "Adjuntos inválidos");
  }

  // Valor informativo del agente: solo válido en egresos. Puede ser % (0–100) o monto fijo (>=0).
  const shareType: "percent" | "amount" = agentShareType === "amount" ? "amount" : "percent";
  let normalizedShare: number | null = null;
  if (agentPercentage !== undefined && agentPercentage !== null && category.kind === "expense") {
    if (typeof agentPercentage !== "number" || !Number.isFinite(agentPercentage) || agentPercentage < 0) {
      throw new AppError(400, "El valor para el agente debe ser un número positivo");
    }
    if (shareType === "percent" && agentPercentage > 100) {
      throw new AppError(400, "El porcentaje del agente debe estar entre 0 y 100");
    }
    normalizedShare = agentPercentage;
  }

  return {
    type: category.kind as "income" | "expense",
    categoryId,
    amount,
    currency: cur,
    date: new Date(`${date}T00:00:00.000Z`),
    description: description?.trim() || null,
    agentUserId: agentUserId || null,
    propertyId: propertyId || null,
    agentPercentage: normalizedShare,
    agentShareType: shareType,
    isShared: isShared === true,
    attachments: (attachments as Prisma.InputJsonValue) ?? undefined,
  };
}
