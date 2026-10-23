// Honorarios de una firma de venta: total, parte del colega y la nuestra.
// Puro (sin DB): lo usan la API, el reporte y los formularios.

export interface SignatureFeeInput {
  operationAmount: number | null;
  feePercentage: number | null;
  withColleague: boolean;
  colleagueSharePercent: number | null;
}

export interface SignatureFees {
  /** Honorarios totales de la operación (valor × %). */
  total: number;
  /** Lo que se lleva el colega (sobre el total). 0 si es 100% nuestra. */
  colleague: number;
  /** Nuestros honorarios: lo que queda "a cobrar". */
  ours: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** null si faltan el valor o el % (todavía no hay honorarios para cobrar). */
export function computeSignatureFees(input: SignatureFeeInput): SignatureFees | null {
  const { operationAmount, feePercentage } = input;
  if (operationAmount == null || feePercentage == null) return null;
  if (!(operationAmount > 0) || !(feePercentage > 0)) return null;
  const total = round2((operationAmount * feePercentage) / 100);
  const share = input.withColleague ? Math.min(100, Math.max(0, input.colleagueSharePercent ?? 0)) : 0;
  const colleague = round2((total * share) / 100);
  return { total, colleague, ours: round2(total - colleague) };
}
