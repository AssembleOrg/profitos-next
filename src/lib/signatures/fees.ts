// Honorarios de una firma de venta: total, parte del colega y la nuestra.
// Puro (sin DB): lo usan la API, el reporte y los formularios.

export interface SignatureFeeInput {
  operationAmount: number | null;
  feePercentage: number | null;
  /** Honorarios totales en monto fijo: si viene (> 0) manda sobre el %. */
  feeAmount?: number | null;
  withColleague: boolean;
  colleagueSharePercent: number | null;
}

export interface SignatureFees {
  /** Honorarios totales de la operación (monto fijo, o valor × %). */
  total: number;
  /** Lo que se lleva el colega (sobre el total). 0 si es 100% nuestra. */
  colleague: number;
  /** Nuestros honorarios. */
  ours: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** null si todavía no hay honorarios (ni monto fijo ni valor + %). */
export function computeSignatureFees(input: SignatureFeeInput): SignatureFees | null {
  const { operationAmount, feePercentage, feeAmount } = input;
  let total: number;
  if (feeAmount != null && feeAmount > 0) {
    total = round2(feeAmount);
  } else {
    if (operationAmount == null || feePercentage == null) return null;
    if (!(operationAmount > 0) || !(feePercentage > 0)) return null;
    total = round2((operationAmount * feePercentage) / 100);
  }
  const share = input.withColleague ? Math.min(100, Math.max(0, input.colleagueSharePercent ?? 0)) : 0;
  const colleague = round2((total * share) / 100);
  return { total, colleague, ours: round2(total - colleague) };
}
