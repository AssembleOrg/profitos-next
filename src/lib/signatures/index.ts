import { DateTime, fromJSDate, now } from "@/lib/datetime";

export const SIGNATURE_STATUSES = [
  "propuesta_enviada",
  "propuesta_aceptada",
  "propuesta_rechazada",
  "espera_informes",
  "comunicacion_partes_finales",
  "fecha_acordada",
  "entrega_llaves",
] as const;

export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export function isSignatureStatus(value: unknown): value is SignatureStatus {
  return typeof value === "string" && (SIGNATURE_STATUSES as readonly string[]).includes(value);
}

export const SIGNATURE_STATUS_LABEL: Record<SignatureStatus, string> = {
  propuesta_enviada: "Propuesta enviada",
  propuesta_aceptada: "Propuesta aceptada",
  propuesta_rechazada: "Propuesta rechazada",
  espera_informes: "Espera de informes",
  comunicacion_partes_finales: "Comunicación de partes",
  fecha_acordada: "Fecha acordada",
  entrega_llaves: "Entrega de llaves",
};

export const SIGNATURE_STATUS_SHORT: Record<SignatureStatus, string> = {
  propuesta_enviada: "Enviada",
  propuesta_aceptada: "Aceptada",
  propuesta_rechazada: "Rechazada",
  espera_informes: "Informes",
  comunicacion_partes_finales: "Partes",
  fecha_acordada: "Fecha",
  entrega_llaves: "Llaves",
};

/**
 * Color palette per status. Tailwind class fragments + hex for SVG/inline.
 */
export const SIGNATURE_STATUS_STYLE: Record<
  SignatureStatus,
  { dot: string; chip: string; line: string }
> = {
  // Flujo de 7 pasos: los intermedios usan `info` (en curso) y `success` queda
  // reservado para el cierre real. Ver docs/design.md § Mapa de estados.
  propuesta_enviada: {
    dot: "bg-info",
    chip: "border-info/30 bg-info-chip text-info",
    line: "bg-info/40",
  },
  propuesta_aceptada: {
    dot: "bg-success",
    chip: "border-success/30 bg-success-chip text-success",
    line: "bg-success/40",
  },
  propuesta_rechazada: {
    dot: "bg-danger",
    chip: "border-danger/30 bg-danger-chip text-danger",
    line: "bg-danger/40",
  },
  espera_informes: {
    dot: "bg-info",
    chip: "border-info/30 bg-info-chip text-info",
    line: "bg-info/40",
  },
  comunicacion_partes_finales: {
    dot: "bg-info",
    chip: "border-info/30 bg-info-chip text-info",
    line: "bg-info/40",
  },
  fecha_acordada: {
    dot: "bg-warning",
    chip: "border-warning/30 bg-warning-chip text-warning",
    line: "bg-warning/40",
  },
  // Cierre del flujo: se marca con la identidad de marca, no con un semántico.
  entrega_llaves: {
    dot: "bg-olive-bright",
    chip: "border-olive-bright/30 bg-olive-chip text-olive-light",
    line: "bg-olive-bright/40",
  },
};

export const SIGNATURE_TERMINAL_STATUSES = [
  "propuesta_rechazada",
  "entrega_llaves",
] satisfies SignatureStatus[];

export function isTerminalStatus(status: SignatureStatus): boolean {
  return (SIGNATURE_TERMINAL_STATUSES as readonly string[]).includes(status);
}

// ──────────────────────────────────────────────────────────────────
// Date <-> Visit mapping
// ──────────────────────────────────────────────────────────────────

export type SignatureDateField = "dateProcessStarted" | "dateAgreed" | "dateKeysHandover";

export interface SignatureDateMeta {
  dbField: "date_process_started" | "date_agreed" | "date_keys_handover";
  visitIdField: "visit_informes_id" | "visit_acordada_id" | "visit_entrega_id";
  visitIdProperty: "visitInformesId" | "visitAcordadaId" | "visitEntregaId";
  visitType: "firma_informes" | "firma_acordada" | "entrega_llaves";
  label: string;
  shortLabel: string;
}

export const SIGNATURE_DATE_META: Record<SignatureDateField, SignatureDateMeta> = {
  dateProcessStarted: {
    dbField: "date_process_started",
    visitIdField: "visit_informes_id",
    visitIdProperty: "visitInformesId",
    visitType: "firma_informes",
    label: "Inicio de trámite (informes)",
    shortLabel: "Informes",
  },
  dateAgreed: {
    dbField: "date_agreed",
    visitIdField: "visit_acordada_id",
    visitIdProperty: "visitAcordadaId",
    visitType: "firma_acordada",
    label: "Fecha acordada de firma",
    shortLabel: "Firma",
  },
  dateKeysHandover: {
    dbField: "date_keys_handover",
    visitIdField: "visit_entrega_id",
    visitIdProperty: "visitEntregaId",
    visitType: "entrega_llaves",
    label: "Entrega de llaves",
    shortLabel: "Llaves",
  },
};

export const SIGNATURE_VISIT_TYPES = [
  "firma_informes",
  "firma_acordada",
  "entrega_llaves",
] as const;

export type SignatureVisitType = (typeof SIGNATURE_VISIT_TYPES)[number];

export function isSignatureVisitType(value: unknown): value is SignatureVisitType {
  return typeof value === "string" && (SIGNATURE_VISIT_TYPES as readonly string[]).includes(value);
}

// ──────────────────────────────────────────────────────────────────
// Filename normalization (NFD, no ñ, no acentos, no espacios)
// ──────────────────────────────────────────────────────────────────

export function slugifyFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll(/ñ/gi, "n")
    .replaceAll(/[^a-zA-Z0-9._-]/g, "_")
    .replaceAll(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ──────────────────────────────────────────────────────────────────
// Attachments shape
// ──────────────────────────────────────────────────────────────────

export type AttachmentKind = "image" | "audio" | "video" | "file";

export interface Attachment {
  kind: AttachmentKind;
  path: string; // storage path (not signed URL)
  name: string;
  size: number;
  mime: string;
}

export function detectAttachmentKind(mime: string): AttachmentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

// ──────────────────────────────────────────────────────────────────
// Upcoming actions (for dashboard widget)
// ──────────────────────────────────────────────────────────────────

export interface UpcomingAction {
  proposalId: string;
  propertyId: string;
  propertyAddress: string;
  dateField: SignatureDateField;
  dateLabel: string;
  date: string; // ISO
  daysAway: number; // negative if past
}

interface ProposalForUpcoming {
  id: string;
  status: string;
  dateProcessStarted: Date | null;
  dateAgreed: Date | null;
  dateKeysHandover: Date | null;
  property: { id: string; address: string };
}

/**
 * Returns the next pending signature events ordered by date asc.
 * Includes events up to `daysAhead` days in the future and up to `daysPast` past
 * (so an entrega de llaves "yesterday" still surfaces as overdue).
 */
export function buildUpcomingActions(
  proposals: ProposalForUpcoming[],
  options: { daysAhead?: number; daysPast?: number; limit?: number } = {},
): UpcomingAction[] {
  const { daysAhead = 30, daysPast = 7, limit = 10 } = options;
  const today = now().startOf("day");
  const future = today.plus({ days: daysAhead });
  const past = today.minus({ days: daysPast });

  const results: UpcomingAction[] = [];
  for (const proposal of proposals) {
    if (proposal.status === "propuesta_rechazada") continue;
    for (const field of ["dateProcessStarted", "dateAgreed", "dateKeysHandover"] as const) {
      const date = proposal[field];
      if (!date) continue;
      const dt = fromJSDate(date).startOf("day");
      if (dt < past || dt > future) continue;
      const meta = SIGNATURE_DATE_META[field];
      results.push({
        proposalId: proposal.id,
        propertyId: proposal.property.id,
        propertyAddress: proposal.property.address,
        dateField: field,
        dateLabel: meta.label,
        date: dt.toISO() ?? "",
        daysAway: Math.round(dt.diff(today, "days").days),
      });
    }
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results.slice(0, limit);
}

export type { DateTime };
