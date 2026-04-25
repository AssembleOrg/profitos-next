import type { RentalDueManualStatus, RentalFrequency } from "@/lib/rentals";

export interface RentalUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
}

export interface RentalProperty {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
  coverImageUrl: string | null;
}

export interface RentalTenant {
  id: string;
  fullName: string;
  idType: string;
  idNumber: string;
  phone: string | null;
  email: string | null;
}

export interface RentalAdditionalCatalogItem {
  id: string;
  name: string;
  defaultAmount: number | null;
  notes?: string | null;
}

export interface ContractAdditional {
  id: string;
  contractId: string;
  additionalId: string;
  amount: number;
  position: number;
  additional: { id: string; name: string; defaultAmount: number | null };
}

export interface DueDateAdditional {
  id: string;
  contractAdditionalId: string;
  included: boolean;
  amountOverride: number | null;
  contractAdditional: Omit<ContractAdditional, "additional"> & {
    additional: { id: string; name: string };
  };
}

export interface PaymentTransaction {
  id: string;
  amountPaid: number;
  commissionAmount: number;
  ownerAmount: number;
  method: string | null;
  paidAt: string;
  isFull: boolean;
  notes: string | null;
  attachments: unknown;
  receiptNumber: number | null;
  receiptPath: string | null;
  receiptIssuedAt: string | null;
  createdByUser: RentalUser;
  createdAt: string;
}

export interface DueDateAction {
  id: string;
  type: "creation" | "nota" | "status_change" | "payment";
  fromStatus: string | null;
  toStatus: string | null;
  description: string | null;
  attachments: unknown;
  createdByUser: RentalUser;
  createdAt: string;
}

export interface SerializedDueDate {
  id: string;
  contractId: string;
  position: number;
  dueDate: string; // ISO date YYYY-MM-DD
  expectedAmount: number;
  status: RentalDueManualStatus | null;
  notes: string | null;
  additionals: DueDateAdditional[];
  transactions: PaymentTransaction[];
  actions: DueDateAction[];
}

export interface SerializedContract {
  id: string;
  property: RentalProperty;
  tenant: RentalTenant;
  title: string | null;
  startDate: string;
  endDate: string;
  frequency: RentalFrequency;
  baseAmount: number;
  currency: string;
  firstDueDate: string;
  gracePeriodDays: number;
  notes: string | null;
  createdByUser: RentalUser;
  additionals: ContractAdditional[];
  dueDates: SerializedDueDate[];
  createdAt: string;
  updatedAt: string;
}
