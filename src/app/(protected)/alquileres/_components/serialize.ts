import type {
  ContractAdditional,
  DueDateAction,
  DueDateAdditional,
  PaymentTransaction,
  SerializedContract,
  SerializedDueDate,
} from "./types";
import type { RentalDueManualStatus, RentalFrequency } from "@/lib/rentals";

interface RawUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
}

interface RawAdditional {
  id: string;
  defaultAmount: number | null;
  name: string;
}

interface RawContractAdditional {
  id: string;
  contractId?: string;
  additionalId: string;
  amount: number;
  position: number;
  additional: RawAdditional;
}

interface RawDueAdditional {
  id: string;
  contractAdditionalId: string;
  included: boolean;
  amountOverride: number | null;
  contractAdditional: {
    id: string;
    contractId?: string;
    additionalId: string;
    amount: number;
    position: number;
    additional: { id: string; name: string };
  };
}

interface RawPayment {
  id: string;
  amountPaid: number;
  commissionAmount: number;
  ownerAmount: number;
  method: string | null;
  paidAt: Date;
  isFull: boolean;
  notes: string | null;
  attachments: unknown;
  receiptNumber: number | null;
  receiptPath: string | null;
  receiptIssuedAt: Date | null;
  createdByUser: RawUser;
  createdAt: Date;
}

interface RawAction {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  description: string | null;
  attachments: unknown;
  createdByUser: RawUser;
  createdAt: Date;
}

interface RawDueDate {
  id: string;
  contractId: string;
  position: number;
  dueDate: Date;
  expectedAmount: number;
  status: string | null;
  notes: string | null;
  additionals: RawDueAdditional[];
  transactions: RawPayment[];
  actions: RawAction[];
}

interface RawContract {
  id: string;
  property: {
    id: string;
    address: string;
    city: string | null;
    zone: string | null;
    coverImageUrl: string | null;
  };
  tenant: {
    id: string;
    fullName: string;
    idType: string;
    idNumber: string;
    phone: string | null;
    email: string | null;
  };
  title: string | null;
  startDate: Date;
  endDate: Date;
  frequency: string;
  baseAmount: number;
  currency: string;
  firstDueDate: Date;
  gracePeriodDays: number;
  notes: string | null;
  createdByUser: RawUser;
  additionals: RawContractAdditional[];
  dueDates: RawDueDate[];
  createdAt: Date;
  updatedAt: Date;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function serializeUser(raw: RawUser) {
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.fullName,
    avatarUrl: raw.avatarUrl ?? null,
  };
}

function serializeContractAdditional(raw: RawContractAdditional, contractId?: string): ContractAdditional {
  return {
    id: raw.id,
    contractId: raw.contractId ?? contractId ?? "",
    additionalId: raw.additionalId,
    amount: raw.amount,
    position: raw.position,
    additional: {
      id: raw.additional.id,
      name: raw.additional.name,
      defaultAmount: raw.additional.defaultAmount,
    },
  };
}

function serializeDueAdditional(raw: RawDueAdditional, contractId?: string): DueDateAdditional {
  const ca = raw.contractAdditional;
  return {
    id: raw.id,
    contractAdditionalId: raw.contractAdditionalId,
    included: raw.included,
    amountOverride: raw.amountOverride,
    contractAdditional: {
      id: ca.id,
      contractId: ca.contractId ?? contractId ?? "",
      additionalId: ca.additionalId,
      amount: ca.amount,
      position: ca.position,
      additional: { id: ca.additional.id, name: ca.additional.name },
    },
  };
}

function serializePayment(raw: RawPayment): PaymentTransaction {
  return {
    id: raw.id,
    amountPaid: raw.amountPaid,
    commissionAmount: raw.commissionAmount,
    ownerAmount: raw.ownerAmount,
    method: raw.method,
    paidAt: raw.paidAt.toISOString(),
    isFull: raw.isFull,
    notes: raw.notes,
    attachments: raw.attachments,
    receiptNumber: raw.receiptNumber,
    receiptPath: raw.receiptPath,
    receiptIssuedAt: raw.receiptIssuedAt?.toISOString() ?? null,
    createdByUser: serializeUser(raw.createdByUser),
    createdAt: raw.createdAt.toISOString(),
  };
}

function serializeAction(raw: RawAction): DueDateAction {
  return {
    id: raw.id,
    type: raw.type as DueDateAction["type"],
    fromStatus: raw.fromStatus,
    toStatus: raw.toStatus,
    description: raw.description,
    attachments: raw.attachments,
    createdByUser: serializeUser(raw.createdByUser),
    createdAt: raw.createdAt.toISOString(),
  };
}

export function serializeDueDate(raw: RawDueDate, contractId?: string): SerializedDueDate {
  return {
    id: raw.id,
    contractId: raw.contractId,
    position: raw.position,
    dueDate: isoDate(raw.dueDate),
    expectedAmount: raw.expectedAmount,
    status: raw.status as RentalDueManualStatus | null,
    notes: raw.notes,
    additionals: raw.additionals.map((a) => serializeDueAdditional(a, contractId ?? raw.contractId)),
    transactions: raw.transactions.map(serializePayment),
    actions: raw.actions.map(serializeAction),
  };
}

export function serializeContract(raw: RawContract): SerializedContract {
  return {
    id: raw.id,
    property: raw.property,
    tenant: raw.tenant,
    title: raw.title,
    startDate: isoDate(raw.startDate),
    endDate: isoDate(raw.endDate),
    frequency: raw.frequency as RentalFrequency,
    baseAmount: raw.baseAmount,
    currency: raw.currency,
    firstDueDate: isoDate(raw.firstDueDate),
    gracePeriodDays: raw.gracePeriodDays,
    notes: raw.notes,
    createdByUser: serializeUser(raw.createdByUser),
    additionals: raw.additionals.map((a) => serializeContractAdditional(a, raw.id)),
    dueDates: raw.dueDates.map((d) => serializeDueDate(d, raw.id)),
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}
