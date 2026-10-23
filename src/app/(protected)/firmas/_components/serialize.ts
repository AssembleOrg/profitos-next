import type { Attachment, SignatureStatus } from "@/lib/signatures";
import type { ReservationDayType } from "@/lib/signatures/reservation-expiry";
import type { FirmaAction, FirmaColleague, FirmaOperation, FirmaProperty, FirmaUser, SerializedFirma } from "./types";

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
  source?: string | null;
}

interface RawProposal {
  id: string;
  property: RawProperty;
  status: string;
  title: string | null;
  description: string | null;
  attachments: unknown;
  reservationDate: Date | null;
  reservationTermDays: number | null;
  reservationDayType: string | null;
  reservationExpiresAt: Date | null;
  dateProcessStarted: Date | null;
  dateAgreed: Date | null;
  dateKeysHandover: Date | null;
  visitInformesId: string | null;
  visitAcordadaId: string | null;
  visitEntregaId: string | null;
  withColleague: boolean;
  colleagueAgency: { id: string; name: string } | null;
  colleagueName: string | null;
  colleagueSharePercent: number | null;
  operationAmount: number | null;
  operationCurrency: string;
  feePercentage: number | null;
  accountEntries?: { status: string }[];
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
    source: raw.source ?? null,
  };
}

function toOperation(raw: RawProposal): FirmaOperation {
  const entries = raw.accountEntries ?? [];
  return {
    amount: raw.operationAmount,
    currency: raw.operationCurrency === "ARS" ? "ARS" : "USD",
    feePercentage: raw.feePercentage,
    receivable: entries.some((e) => e.status === "collected")
      ? "collected"
      : entries.some((e) => e.status === "pending")
        ? "pending"
        : "none",
  };
}

function toColleague(raw: Pick<RawProposal, "withColleague" | "colleagueAgency" | "colleagueName" | "colleagueSharePercent">): FirmaColleague {
  return {
    withColleague: raw.withColleague,
    agencyId: raw.colleagueAgency?.id ?? null,
    agencyName: raw.colleagueAgency?.name ?? null,
    name: raw.colleagueName,
    sharePercent: raw.colleagueSharePercent,
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
    reservationDate: raw.reservationDate?.toISOString() ?? null,
    reservationTermDays: raw.reservationTermDays,
    reservationDayType: raw.reservationDayType as ReservationDayType | null,
    reservationExpiresAt: raw.reservationExpiresAt?.toISOString() ?? null,
    dateProcessStarted: raw.dateProcessStarted?.toISOString() ?? null,
    dateAgreed: raw.dateAgreed?.toISOString() ?? null,
    dateKeysHandover: raw.dateKeysHandover?.toISOString() ?? null,
    visitInformesId: raw.visitInformesId,
    visitAcordadaId: raw.visitAcordadaId,
    visitEntregaId: raw.visitEntregaId,
    colleague: toColleague(raw),
    operation: toOperation(raw),
    createdByUser: toUser(raw.createdByUser),
    actions: raw.actions.map(toAction),
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

/**
 * Lo mismo que serializeProposal pero desde la respuesta JSON de la API
 * (fechas como string). Lo usan los modales de alta y detalle.
 */
export function serializeFromApi(raw: unknown): SerializedFirma {
  const r = raw as Record<string, unknown>;
  const iso = (v: unknown) => (v ? new Date(v as string) : null);
  const actions = ((r.actions as Record<string, unknown>[]) ?? []).map((a) => ({
    ...(a as unknown as RawAction),
    createdAt: new Date(a.createdAt as string),
  }));
  return serializeProposal({
    ...(r as unknown as RawProposal),
    colleagueAgency: (r.colleagueAgency as RawProposal["colleagueAgency"]) ?? null,
    withColleague: r.withColleague === true,
    colleagueName: (r.colleagueName as string | null) ?? null,
    colleagueSharePercent: (r.colleagueSharePercent as number | null) ?? null,
    operationAmount: (r.operationAmount as number | null) ?? null,
    operationCurrency: (r.operationCurrency as string) ?? "USD",
    feePercentage: (r.feePercentage as number | null) ?? null,
    accountEntries: (r.accountEntries as { status: string }[]) ?? [],
    reservationDate: iso(r.reservationDate),
    reservationExpiresAt: iso(r.reservationExpiresAt),
    dateProcessStarted: iso(r.dateProcessStarted),
    dateAgreed: iso(r.dateAgreed),
    dateKeysHandover: iso(r.dateKeysHandover),
    actions,
    createdAt: new Date(r.createdAt as string),
    updatedAt: new Date(r.updatedAt as string),
  });
}

/** Acción de la línea de tiempo desde la respuesta JSON de la API. */
export function serializeActionFromApi(raw: unknown): FirmaAction {
  const r = raw as Record<string, unknown>;
  return toAction({ ...(r as unknown as RawAction), createdAt: new Date(r.createdAt as string) });
}
