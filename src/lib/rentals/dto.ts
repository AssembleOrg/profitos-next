/**
 * DTOs serializables de alquileres v2 (server → client). Solo tipos: los
 * importan las páginas server, las APIs y los componentes cliente.
 */
import type { RentalDueEffectiveStatus } from "@/lib/rentals";
import type { ChargeLine, ChargeSplit } from "@/lib/rentals/money";

export type AdjustmentAlert = "none" | "upcoming" | "due" | "overdue";

export interface PartyRef {
  id: string;
  fullName: string;
  idType: string | null;
  idNumber: string | null;
  phone: string | null;
  email: string | null;
}

export interface PropertyRef {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
  type: string | null;
  coverImageUrl: string | null;
}

/** Un vencimiento en la agenda del mes. */
export interface AgendaDue {
  dueId: string;
  contractId: string;
  dueDate: string; // YYYY-MM-DD
  position: number;
  status: RentalDueEffectiveStatus;
  expected: number;
  collected: number;
  currency: string;
  property: PropertyRef;
  unit: string | null;
  tenant: PartyRef;
  ownerName: string | null;
  feePercent: number;
  /** Servicios que paga el inquilino y comprobantes que subió para este período. */
  servicesRequired: string[];
  servicesUploaded: string[];
  pendingProofs: number;
  kind: string;
}

export interface AgendaAdjustment {
  contractId: string;
  date: string; // YYYY-MM-DD
  alert: AdjustmentAlert;
  index: string | null;
  everyMonths: number | null;
  currentAmount: number;
  currency: string;
  property: PropertyRef;
  unit: string | null;
  tenantName: string;
}

export interface AgendaEnding {
  contractId: string;
  date: string;
  property: PropertyRef;
  unit: string | null;
  tenantName: string;
}

export interface MonthSummary {
  expected: number;
  collected: number;
  overdue: number;
  pending: number;
  fees: number;
  toOwners: number;
  counts: Record<RentalDueEffectiveStatus, number>;
}

export interface AgendaMonth {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD
  dues: AgendaDue[];
  adjustments: AgendaAdjustment[];
  endings: AgendaEnding[];
  summary: MonthSummary;
  pendingProofs: number;
  /** Aumentos vencidos o de este mes sin aplicar, de cualquier mes (alerta global). */
  adjustmentsToApply: AgendaAdjustment[];
  overdueElsewhere: number;
}

export type ContractStatus = "vigente" | "por_vencer" | "finalizado" | "futuro";

export interface ContractRow {
  id: string;
  kind: string;
  title: string | null;
  property: PropertyRef;
  unit: string | null;
  tenant: PartyRef;
  owner: PartyRef | null;
  startDate: string;
  endDate: string;
  baseAmount: number;
  currency: string;
  feePercent: number;
  dueDay: number | null;
  adjustment: { everyMonths: number | null; index: string | null; nextDate: string | null; alert: AdjustmentAlert };
  status: ContractStatus;
  nextDue: { id: string; date: string; status: RentalDueEffectiveStatus; amount: number } | null;
  overdueCount: number;
  overdueAmount: number;
}

export interface ReceiptRef {
  id: string;
  bookKind: "inquilino" | "propietario";
  pointOfSale: number;
  number: number;
  status: "emitido" | "anulado";
  amount: number | null;
  hasPdf: boolean;
  issuedAt: string | null;
  voidReason: string | null;
}

export interface PaymentDTO {
  id: string;
  paidAt: string;
  amountPaid: number;
  commissionAmount: number;
  ownerAmount: number;
  feePercent: number | null;
  isFull: boolean;
  method: string | null;
  notes: string | null;
  lines: ChargeLine[] | null;
  receiptNotes: string | null;
  receipts: ReceiptRef[];
  legacyReceipt: { number: number; path: string | null } | null;
  createdBy: string;
  attachments: unknown;
}

export interface DueLine {
  /** RentalDueDateAdditional.id */
  linkId: string;
  contractAdditionalId: string;
  name: string;
  amount: number;
  included: boolean;
}

export interface DossierDue {
  id: string;
  position: number;
  dueDate: string;
  status: RentalDueEffectiveStatus;
  manualStatus: string | null;
  rent: number;
  expected: number;
  collected: number;
  lines: DueLine[];
  notes: string | null;
  payments: PaymentDTO[];
}

export interface ServiceProofDTO {
  id: string;
  contractId: string;
  service: string;
  period: string;
  amount: number | null;
  attachments: unknown;
  notes: string | null;
  status: "pendiente" | "aprobado" | "rechazado";
  reviewNote: string | null;
  uploadedByTenant: boolean;
  createdAt: string;
  reviewedAt: string | null;
  property?: PropertyRef;
  unit?: string | null;
  tenantName?: string;
}

export interface AdjustmentDTO {
  id: string;
  effectiveDate: string;
  previousAmount: number;
  newAmount: number;
  indexLabel: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ContractDossier extends ContractRow {
  frequency: string;
  firstDueDate: string;
  gracePeriodDays: number;
  notes: string | null;
  attachments: unknown;
  tenantServices: string[];
  guaranteeType: string | null;
  guaranteeDetail: string | null;
  depositAmount: number | null;
  advanceAmount: number | null;
  advanceDetail: string | null;
  additionals: Array<{ id: string; additionalId: string; name: string; amount: number }>;
  dues: DossierDue[];
  adjustments: AdjustmentDTO[];
  proofs: ServiceProofDTO[];
  tenantPortal: { enabled: boolean; hasAccount: boolean; invitedAt: string | null; lastLoginAt: string | null };
  totals: { expected: number; collected: number; fees: number; toOwner: number };
}

/** Contexto para la hoja de cobro. */
export interface CollectContext {
  dueId: string;
  contractId: string;
  dueDate: string;
  periodLabel: string;
  status: RentalDueEffectiveStatus;
  currency: string;
  property: PropertyRef;
  unit: string | null;
  tenant: PartyRef;
  owner: PartyRef | null;
  feePercent: number;
  rent: number;
  lines: Array<ChargeLine & { included: boolean }>;
  alreadyCollected: number;
  expected: number;
  books: ReceiptBookDTO[];
  tenantServices: string[];
  proofsThisPeriod: ServiceProofDTO[];
  adjustmentAlert: AdjustmentAlert;
  adjustmentDate: string | null;
}

export interface ReceiptBookDTO {
  kind: "inquilino" | "propietario";
  label: string;
  pointOfSale: number;
  nextNumber: number;
  configured: boolean;
}

export interface ReceiptListItem extends ReceiptRef {
  contractId: string | null;
  propertyAddress: string | null;
  unit: string | null;
  tenantName: string | null;
  ownerName: string | null;
  period: string | null;
  createdBy: string | null;
  voidedAt: string | null;
}

export type { ChargeLine, ChargeSplit };
