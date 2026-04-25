import type { Attachment, SignatureStatus } from "@/lib/signatures";
import type { FirmaAction, FirmaProperty, FirmaUser, SerializedFirma } from "./types";

interface RawUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl?: string | null;
}

interface RawAction {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  dateField: string | null;
  description: string | null;
  attachments: unknown;
  createdByUser: RawUser;
  createdAt: Date;
}

interface RawProperty {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
  type: string | null;
  status: string;
  operationType: string | null;
  coverImageUrl: string | null;
  photos: unknown;
}

interface RawProposal {
  id: string;
  property: RawProperty;
  status: string;
  title: string | null;
  description: string | null;
  attachments: unknown;
  dateProcessStarted: Date | null;
  dateAgreed: Date | null;
  dateKeysHandover: Date | null;
  visitInformesId: string | null;
  visitAcordadaId: string | null;
  visitEntregaId: string | null;
  createdByUser: RawUser;
  actions: RawAction[];
  createdAt: Date;
  updatedAt: Date;
}

function toAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Attachment =>
      v !== null &&
      typeof v === "object" &&
      typeof (v as Attachment).path === "string" &&
      typeof (v as Attachment).kind === "string",
  );
}

function toUser(raw: RawUser): FirmaUser {
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.fullName,
    avatarUrl: raw.avatarUrl ?? null,
  };
}

function toProperty(raw: RawProperty): FirmaProperty {
  let cover = raw.coverImageUrl ?? null;
  if (!cover && Array.isArray(raw.photos) && raw.photos.length > 0) {
    const first = raw.photos[0];
    if (typeof first === "string") cover = first;
    else if (
      first !== null &&
      typeof first === "object" &&
      "url" in first &&
      typeof (first as { url: unknown }).url === "string"
    ) {
      cover = (first as { url: string }).url;
    }
  }
  return {
    id: raw.id,
    address: raw.address,
    city: raw.city,
    zone: raw.zone,
    type: raw.type,
    status: raw.status,
    operationType: raw.operationType,
    coverImageUrl: cover,
  };
}

function toAction(raw: RawAction): FirmaAction {
  return {
    id: raw.id,
    type: raw.type as FirmaAction["type"],
    fromStatus: raw.fromStatus as SignatureStatus | null,
    toStatus: raw.toStatus as SignatureStatus | null,
    dateField: raw.dateField,
    description: raw.description,
    attachments: toAttachments(raw.attachments),
    createdByUser: toUser(raw.createdByUser),
    createdAt: raw.createdAt.toISOString(),
  };
}

export function serializeProposal(raw: RawProposal): SerializedFirma {
  return {
    id: raw.id,
    property: toProperty(raw.property),
    status: raw.status as SignatureStatus,
    title: raw.title,
    description: raw.description,
    attachments: toAttachments(raw.attachments),
    dateProcessStarted: raw.dateProcessStarted?.toISOString() ?? null,
    dateAgreed: raw.dateAgreed?.toISOString() ?? null,
    dateKeysHandover: raw.dateKeysHandover?.toISOString() ?? null,
    visitInformesId: raw.visitInformesId,
    visitAcordadaId: raw.visitAcordadaId,
    visitEntregaId: raw.visitEntregaId,
    createdByUser: toUser(raw.createdByUser),
    actions: raw.actions.map(toAction),
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}
