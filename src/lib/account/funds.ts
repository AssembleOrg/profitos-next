// ────────────────────────────────────────────────────────────────────
// Bolsillos de plata: dónde está físicamente la plata de la inmobiliaria.
//   caja    → efectivo en la oficina (lo que tiene Julieta)
//   banco   → transferencias / Mercado Pago / cheques
//   persona → plata que se llevó alguien (retiros de Juli, gastos que pagó)
// Helpers puros (cliente y servidor).
// ────────────────────────────────────────────────────────────────────

export type FundKind = "caja" | "banco" | "persona";

export const FUND_KINDS: FundKind[] = ["caja", "banco", "persona"];

export const FUND_LABEL: Record<FundKind, string> = {
  caja: "Caja de la oficina",
  banco: "Banco",
  persona: "Persona",
};

export function isFundKind(value: unknown): value is FundKind {
  return value === "caja" || value === "banco" || value === "persona";
}

/** Clave única de bolsillo: "caja" | "banco" | "persona:<userId>". */
export function fundKey(fund: FundKind, userId: string | null | undefined): string {
  return fund === "persona" ? `persona:${userId ?? ""}` : fund;
}

/** "persona:<id>" → { fund: "persona", userId }. null si la clave no es válida. */
export function parseFundKey(key: string | null | undefined): { fund: FundKind; userId: string | null } | null {
  if (!key) return null;
  if (key === "caja" || key === "banco") return { fund: key, userId: null };
  if (key.startsWith("persona:") && key.length > "persona:".length) {
    return { fund: "persona", userId: key.slice("persona:".length) };
  }
  return null;
}

/** Bolsillo donde entra un cobro de alquiler según el medio de pago. */
export function fundForMethod(method: string | null | undefined): "caja" | "banco" {
  if (!method) return "caja";
  return /efectivo/i.test(method) ? "caja" : "banco";
}

/** Reparte un monto en N cuotas (centavos exactos: la última absorbe el redondeo). */
export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] += cents - base * count;
  return parts.map((c) => c / 100);
}
