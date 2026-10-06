import { AppError } from "@/lib/api/handler";
import { sanitizeFeePercent } from "@/lib/rentals/money";

/**
 * Condiciones del legajo de alquiler tradicional (v2): las comparten el alta
 * (POST /api/alquileres) y la edición (PATCH /api/alquileres/[id]). Solo se
 * devuelven las claves presentes en el body, para que el PATCH sea parcial.
 */

export const GUARANTEE_TYPES = ["propietaria", "seguro_caucion", "recibo_sueldo", "otra", "ninguna"] as const;
export const ADJUSTMENT_INDEXES = ["IPC", "ICL", "CAC", "Casa Propia", "Fijo", "Otro"] as const;
export const TENANT_SERVICE_OPTIONS = ["Luz", "Gas", "Agua", "Municipal", "Expensas", "Internet"] as const;

export interface ContractConditions {
  ownerId?: string | null;
  unit?: string | null;
  feePercent?: number;
  dueDay?: number | null;
  adjustmentEveryMonths?: number | null;
  adjustmentIndex?: string | null;
  adjustmentNextDate?: Date | null;
  tenantServices?: string[];
  guaranteeType?: string | null;
  guaranteeDetail?: string | null;
  depositAmount?: number | null;
  advanceAmount?: number | null;
  advanceDetail?: string | null;
}

function optText(v: unknown, max = 300): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function optAmount(v: unknown, label: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new AppError(400, `${label} inválido`);
  return v;
}

function optDate(v: unknown, label: string): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) throw new AppError(400, `${label} inválida`);
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `${label} inválida`);
  return d;
}

export function parseContractConditions(body: Record<string, unknown>): ContractConditions {
  const out: ContractConditions = {};
  if ("ownerId" in body) out.ownerId = optText(body.ownerId, 64);
  if ("unit" in body) out.unit = optText(body.unit, 60);
  if ("feePercent" in body) out.feePercent = sanitizeFeePercent(body.feePercent);
  if ("dueDay" in body) {
    const n = body.dueDay;
    if (n === null || n === "" || n === undefined) out.dueDay = null;
    else if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 31) out.dueDay = n;
    else throw new AppError(400, "Día de vencimiento inválido");
  }
  if ("adjustmentEveryMonths" in body) {
    const n = body.adjustmentEveryMonths;
    if (n === null || n === "" || n === undefined || n === 0) out.adjustmentEveryMonths = null;
    else if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 36) out.adjustmentEveryMonths = n;
    else throw new AppError(400, "Frecuencia de aumento inválida");
  }
  if ("adjustmentIndex" in body) out.adjustmentIndex = optText(body.adjustmentIndex, 40);
  if ("adjustmentNextDate" in body) out.adjustmentNextDate = optDate(body.adjustmentNextDate, "Fecha de aumento");
  if ("tenantServices" in body) {
    const raw = Array.isArray(body.tenantServices) ? body.tenantServices : [];
    out.tenantServices = [...new Set(raw.filter((s): s is string => typeof s === "string").map((s) => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 12);
  }
  if ("guaranteeType" in body) {
    const g = optText(body.guaranteeType, 30);
    if (g && !(GUARANTEE_TYPES as readonly string[]).includes(g)) throw new AppError(400, "Tipo de garantía inválido");
    out.guaranteeType = g;
  }
  if ("guaranteeDetail" in body) out.guaranteeDetail = optText(body.guaranteeDetail, 500);
  if ("depositAmount" in body) out.depositAmount = optAmount(body.depositAmount, "Depósito");
  if ("advanceAmount" in body) out.advanceAmount = optAmount(body.advanceAmount, "Anticipo");
  if ("advanceDetail" in body) out.advanceDetail = optText(body.advanceDetail, 300);
  return out;
}
