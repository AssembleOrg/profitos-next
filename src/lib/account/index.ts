// ────────────────────────────────────────────────────────────────────
// Dominio: Estados de cuenta (caja/finanzas de la inmobiliaria)
// Helpers puros (sin acceso a DB). El acceso a datos vive en ./server.
// ────────────────────────────────────────────────────────────────────

export type Currency = "ARS" | "USD";
export type EntryType = "income" | "expense";
export type MovementSource = "manual" | "rental_commission" | "costear" | "agent_commission";

/** Área del negocio de una categoría. null = sin área (solo aparece en General). */
export type AccountArea = "administracion" | "ventas";
/** Vista de estados de cuenta: un área o el movimiento general de la empresa. */
export type AccountView = AccountArea | "general";

export const ACCOUNT_AREAS: AccountArea[] = ["administracion", "ventas"];
export const AREA_LABEL: Record<AccountArea, string> = {
  administracion: "Administración",
  ventas: "Ventas",
};

export function isAccountArea(value: unknown): value is AccountArea {
  return value === "administracion" || value === "ventas";
}

export const CURRENCIES: Currency[] = ["ARS", "USD"];
export const ENTRY_TYPES: EntryType[] = ["income", "expense"];

/** Categoría de sistema que usan las comisiones de alquiler virtuales. */
export const RENTAL_COMMISSION_CATEGORY_ID = "sys_rental_commission";

/** Prefijo de id de las comisiones de agente derivadas (`agent:<id del ingreso>`). */
export const AGENT_COMMISSION_ID_PREFIX = "agent:";

/** Ventana en horas durante la cual un movimiento manual puede editarse. */
export const EDIT_WINDOW_HOURS = 72;

export function isCurrency(value: unknown): value is Currency {
  return value === "ARS" || value === "USD";
}

export function isEntryType(value: unknown): value is EntryType {
  return value === "income" || value === "expense";
}

/**
 * ¿El movimiento sigue dentro de la ventana de edición (72 hs desde su creación)?
 * Las comisiones de alquiler nunca son editables (no es un movimiento manual).
 */
export function isWithinEditWindow(createdAt: Date | string, nowMs: number = Date.now()): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const elapsedMs = nowMs - created.getTime();
  return elapsedMs >= 0 && elapsedMs <= EDIT_WINDOW_HOURS * 60 * 60 * 1000;
}

// ── Formato de moneda (es-AR) ──────────────────────────────────────

const numberFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CURRENCY_SYMBOL: Record<Currency, string> = {
  ARS: "$",
  USD: "US$",
};

export function currencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOL[currency] ?? "$";
}

export function formatMoney(amount: number, currency: Currency, opts: { decimals?: boolean } = {}): string {
  const formatter = opts.decimals ? decimalFormatter : numberFormatter;
  const sign = amount < 0 ? "-" : "";
  return `${sign}${CURRENCY_SYMBOL[currency]} ${formatter.format(Math.abs(amount))}`;
}

// ── Periodos / meses ───────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-05-29" -> "2026-05" */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** "2026-05" -> "Mayo 2026" */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const idx = Number(month) - 1;
  return `${MONTH_NAMES[idx] ?? month} ${year}`;
}

// ── Comisión del agente ────────────────────────────────────────────

/**
 * Monto que se lleva el agente: % sobre el monto del movimiento o monto fijo.
 * 0 si no hay agente o comisión cargada.
 */
export function agentCommissionAmount(
  m: Pick<AccountMovement, "amount" | "agentUserId" | "agentPercentage" | "agentShareType">
): number {
  if (!m.agentUserId || m.agentPercentage == null || !(m.agentPercentage > 0)) return 0;
  const raw = m.agentShareType === "amount" ? m.agentPercentage : (m.amount * m.agentPercentage) / 100;
  return Math.round(raw * 100) / 100;
}

/**
 * Egreso automático "Comisión de agente" derivado de un ingreso con agente.
 * Los ingresos se muestran completos; la comisión baja por egresos.
 */
export function deriveAgentCommission(income: AccountMovement): AccountMovement | null {
  if (income.type !== "income" || income.source !== "manual") return null;
  const amount = agentCommissionAmount(income);
  if (amount <= 0) return null;
  const share =
    income.agentShareType === "amount"
      ? "monto fijo"
      : `${income.agentPercentage}% de ${formatMoney(income.amount, income.currency)}`;
  return {
    ...income,
    id: `${AGENT_COMMISSION_ID_PREFIX}${income.id}`,
    parentId: income.id,
    source: "agent_commission",
    type: "expense",
    categoryId: null,
    categoryName: "Comisión de agente",
    categoryColor: "#f97316",
    amount,
    description: `${share}${income.categoryName ? ` · ${income.categoryName}` : ""}`,
    feePercentage: null,
    attachments: null,
  };
}

// ── Shapes de lectura ──────────────────────────────────────────────

export interface AccountMovement {
  id: string;
  source: MovementSource;
  type: EntryType;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  /** Área de la categoría (las comisiones de alquiler son "administracion"). */
  area: AccountArea | null;
  amount: number;
  currency: Currency;
  /** Fecha contable, ISO YYYY-MM-DD. */
  date: string;
  description: string | null;
  agentUserId: string | null;
  agentName: string | null;
  propertyId: string | null;
  propertyAddress: string | null;
  /** Honorarios de la inmobiliaria: % sobre el valor de la operación (informativo). */
  feePercentage: number | null;
  /** Comisión del agente (obligatoria si hay agente): % del movimiento o monto fijo. */
  agentPercentage: number | null;
  /** "percent" | "amount" — cómo interpretar agentPercentage. */
  agentShareType: "percent" | "amount";
  /** Marca informativa: ¿movimiento compartido? */
  isShared: boolean;
  /** Inmobiliaria con la que se comparte (solo si isShared). */
  sharedAgencyId: string | null;
  sharedAgencyName: string | null;
  attachments: unknown;
  createdByUserId: string;
  createdByName: string | null;
  /** ISO timestamp de creación (para la ventana de 72 hs). */
  createdAt: string;
  /** Solo en comisiones de agente derivadas: id del ingreso que las origina. */
  parentId?: string | null;
  /** "pending" = honorarios a cobrar de una firma (no suman hasta cobrarse). */
  status: "collected" | "pending";
  /** Firma que originó los honorarios. */
  signatureProposalId: string | null;
}

/** Firmas de venta del periodo: propias vs compartidas con colega. */
export interface SalesStatsGroup {
  count: number;
  closed: number;
  /** Nuestros honorarios (después de compartir) por moneda. */
  fees: Partial<Record<Currency, number>>;
}

export interface SalesStats {
  total: number;
  own: SalesStatsGroup;
  shared: SalesStatsGroup;
}

export interface MonthBucket {
  month: string; // "YYYY-MM"
  label: string; // "Mayo 2026"
  income: number;
  expense: number;
  net: number;
  /** Saldo acumulado al inicio del mes (modo cierre mensual). */
  opening: number;
  /** Saldo acumulado al cierre del mes. */
  closing: number;
  movements: AccountMovement[];
}

export interface CurrencyReport {
  currency: Currency;
  totalIncome: number;
  totalExpense: number;
  net: number;
  /**
   * Total de gastos personales de Costear en el rango. Informativo, NO entra
   * en totalExpense/net ni en el saldo acumulado (no es plata de la inmobiliaria).
   */
  personalExpense: number;
  /** Saldo acumulado anterior al rango filtrado. */
  opening: number;
  /** Saldo acumulado al final del rango (opening + net). */
  closing: number;
  months: MonthBucket[];
}

export interface AccountReport {
  /** Movimientos del rango filtrado, ordenados por fecha desc. (todas las monedas). */
  movements: AccountMovement[];
  /** Honorarios de firmas a cobrar (pendientes, sin importar el rango). */
  receivables: AccountMovement[];
  /** Estadística de firmas de venta (solo en la vista Ventas). */
  sales: SalesStats | null;
  /** Reporte por moneda con saldo acumulado mensual. */
  byCurrency: CurrencyReport[];
}

export type OpeningByCurrency = Partial<Record<Currency, number>>;

/**
 * Construye el reporte por moneda con subtotales y saldo acumulado mensual.
 *
 * @param movements  movimientos YA filtrados (dentro del rango)
 * @param opening    saldo neto acumulado ANTES del rango, por moneda
 * @param currencies monedas a incluir (las que el filtro pida; por defecto ARS y USD)
 */
export function buildReport(
  movements: AccountMovement[],
  opening: OpeningByCurrency,
  currencies: Currency[] = CURRENCIES
): AccountReport {
  const sorted = [...movements].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1; // fecha desc
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  const byCurrency: CurrencyReport[] = currencies.map((currency) => {
    const ofCurrency = sorted.filter((m) => m.currency === currency);

    // Agrupar por mes (asc para acumular saldo).
    const monthMap = new Map<string, AccountMovement[]>();
    for (const m of ofCurrency) {
      const key = monthKey(m.date);
      const arr = monthMap.get(key);
      if (arr) arr.push(m);
      else monthMap.set(key, [m]);
    }
    const monthKeys = [...monthMap.keys()].sort(); // asc

    let running = opening[currency] ?? 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let personalExpense = 0;

    const months: MonthBucket[] = monthKeys.map((key) => {
      const items = monthMap.get(key)!;
      let income = 0;
      let expense = 0;
      for (const m of items) {
        // Los gastos personales (Costear) se listan pero NO afectan el saldo
        // de la inmobiliaria: se acumulan aparte.
        if (m.source === "costear") {
          personalExpense += m.amount;
          continue;
        }
        if (m.type === "income") income += m.amount;
        else expense += m.amount;
      }
      const net = income - expense;
      const openingMonth = running;
      running += net;
      totalIncome += income;
      totalExpense += expense;
      return {
        month: key,
        label: monthLabel(key),
        income,
        expense,
        net,
        opening: openingMonth,
        closing: running,
        // movimientos del mes en orden desc para mostrar
        movements: [...items].sort((a, b) =>
          a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1
        ),
      };
    });

    const openingBalance = opening[currency] ?? 0;
    return {
      currency,
      totalIncome,
      totalExpense,
      personalExpense,
      net: totalIncome - totalExpense,
      opening: openingBalance,
      closing: openingBalance + (totalIncome - totalExpense),
      months,
    };
  });

  return { movements: sorted, byCurrency, receivables: [], sales: null };
}
