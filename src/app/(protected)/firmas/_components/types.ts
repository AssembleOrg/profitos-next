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

export interface FirmaColleague {
  withColleague: boolean;
  agencyId: string | null;
  agencyName: string | null;
  name: string | null;
  sharePercent: number | null;
}

export interface FirmaAction {
  id: string;
  type: "creation" | "nota" | "status_change" | "date_set" | "reservation_update" | "colleague_update";
  fromStatus: SignatureStatus | null;
  toStatus: SignatureStatus | null;
  dateField: string | null;
  description: string | null;
  attachments: Attachment[];
  createdByUser: FirmaUser;
  createdAt: string;
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
  dateProcessStarted: string | null;
  dateAgreed: string | null;
  dateKeysHandover: string | null;
  visitInformesId: string | null;
  visitAcordadaId: string | null;
  visitEntregaId: string | null;
  colleague: FirmaColleague;
  createdByUser: FirmaUser;
  actions: FirmaAction[];
  createdAt: string;
  updatedAt: string;
}
