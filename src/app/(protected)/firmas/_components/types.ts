import type { Attachment, SignatureStatus } from "@/lib/signatures";
import type { ReservationDayType } from "@/lib/signatures/reservation-expiry";

export interface FirmaUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
}

export interface FirmaProperty {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
  type: string | null;
  status: string;
  operationType: string | null;
  coverImageUrl: string | null;
  /** "colega" = ficha mínima de un inmueble en cartera de un colega (no publicado). */
  source: string | null;
}

export interface FirmaOperation {
  amount: number | null;
  currency: "ARS" | "USD";
  feePercentage: number | null;
  /** Honorarios totales en monto fijo (manda sobre el %). */
  feeAmount: number | null;
  /** Estado de los honorarios en estados de cuenta. */
  receivable: "none" | "pending" | "collected";
}

export interface FirmaColleague {
  withColleague: boolean;
  agencyId: string | null;
  agencyName: string | null;
  name: string | null;
  sharePercent: number | null;
  /** Cobramos el total y le pagamos su parte al colega. */
  collectsAll: boolean;
}

export interface FirmaAction {
  id: string;
  type: "creation" | "nota" | "status_change" | "date_set" | "reservation_update" | "colleague_update" | "operation_update" | "parties_update" | "closure";
  fromStatus: SignatureStatus | null;
  toStatus: SignatureStatus | null;
  dateField: string | null;
  description: string | null;
  attachments: Attachment[];
  createdByUser: FirmaUser;
  createdAt: string;
}

export interface FirmaClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface SerializedFirma {
  id: string;
  property: FirmaProperty;
  status: SignatureStatus;
  title: string | null;
  description: string | null;
  attachments: Attachment[];
  reservationDate: string | null;
  reservationTermDays: number | null;
  reservationDayType: ReservationDayType | null;
  reservationExpiresAt: string | null;
  hasReinforcement: boolean;
  reinforcementDate: string | null;
  reinforcementTermDays: number | null;
  reinforcementDayType: ReservationDayType | null;
  reinforcementExpiresAt: string | null;
  /** Sobres en resguardo: monto de la reserva (sobre 1) y del refuerzo (sobre 2). */
  reservationAmount: number | null;
  reservationCurrency: "USD" | "ARS";
  reinforcementAmount: number | null;
  reinforcementCurrency: "USD" | "ARS";
  /** Operación cerrada (sale de la lista; filtro "Cerradas"). */
  closedAt: string | null;
  buyer: FirmaClient | null;
  seller: FirmaClient | null;
  /** El vencimiento está agendado en Google Calendar. */
  reservationOnCalendar: boolean;
  reinforcementOnCalendar: boolean;
  dateProcessStarted: string | null;
  dateAgreed: string | null;
  dateKeysHandover: string | null;
  visitInformesId: string | null;
  visitAcordadaId: string | null;
  visitEntregaId: string | null;
  colleague: FirmaColleague;
  operation: FirmaOperation;
  createdByUser: FirmaUser;
  actions: FirmaAction[];
  createdAt: string;
  updatedAt: string;
}
