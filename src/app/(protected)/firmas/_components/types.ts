import type { Attachment, SignatureStatus } from "@/lib/signatures";

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
}

export interface FirmaAction {
  id: string;
  type: "creation" | "nota" | "status_change" | "date_set";
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
  dateProcessStarted: string | null;
  dateAgreed: string | null;
  dateKeysHandover: string | null;
  visitInformesId: string | null;
  visitAcordadaId: string | null;
  visitEntregaId: string | null;
  createdByUser: FirmaUser;
  actions: FirmaAction[];
  createdAt: string;
  updatedAt: string;
}
