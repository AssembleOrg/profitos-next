"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import type { Attachment } from "@/lib/signatures";
import { MediaUploader } from "./media-uploader";
import { useSignedUrls } from "./use-signed-urls";
import type { SerializedFirma } from "./types";

export interface PropertyOption {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
  operationType: string | null;
}

interface CreateFirmaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropertyOption[];
  /** Pre-select a property when opening (e.g. coming from a property page in the future). */
  initialPropertyId?: string;
  onCreated: (firma: SerializedFirma) => void;
}

export function CreateFirmaModal({
  open,
  onOpenChange,
  properties,
  initialPropertyId,
  onCreated,
}: Readonly<CreateFirmaModalProps>) {
  const [propertyId, setPropertyId] = useState("");
  const [propertyQuery, setPropertyQuery] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const paths = attachments.map((a) => a.path);
  const signedUrls = useSignedUrls(paths);

  useEffect(() => {
    if (!open) return;
    setPropertyId(initialPropertyId ?? "");
    setPropertyQuery("");
    setTitle("");
    setDescription("");
    setAttachments([]);
  }, [open, initialPropertyId]);

  const filteredProperties = useMemo(() => {
    const q = propertyQuery.trim().toLowerCase();
    if (!q) return properties.slice(0, 60);
    return properties
      .filter((p) =>
        [p.address, p.city, p.zone].some((v) => v?.toLowerCase().includes(q)),
      )
      .slice(0, 60);
  }, [properties, propertyQuery]);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  async function submit() {
    if (!propertyId) {
      toast.error("Seleccioná una propiedad");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/firmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          title: title.trim() || null,
          description: description.trim() || null,
          attachments,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onCreated(serializeFromApi(body.data));
      toast.success("Propuesta creada");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title="Nueva propuesta"
      description="Iniciá un proceso de firma adjuntando lo necesario."
      maxWidth="sm:max-w-[640px]"
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-[13px] font-semibold text-text-faint transition-colors hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-11 items-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creando…" : "Crear propuesta"}
          </button>
        </div>
      }
    >
                <div>
                  <div className="flex flex-col gap-5">
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-text-muted">
                        <span>Propiedad</span>
                        {selectedProperty && (
                          <button
                            type="button"
                            onClick={() => setPropertyId("")}
                            className="text-[12.5px] font-bold text-terra transition-opacity hover:opacity-80"
                          >
                            Cambiar
                          </button>
                        )}
                      </label>
                      {selectedProperty ? (
                        <div className="flex items-center justify-between rounded-[14px] bg-sand-chip px-3.5 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-bold text-text">{selectedProperty.address}</p>
                            <p className="truncate text-[11.5px] text-text-muted">
                              {[selectedProperty.zone, selectedProperty.city, selectedProperty.operationType]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex h-11 items-center gap-2 rounded-[14px] border border-border bg-surface px-3.5 focus-within:border-border-strong">
                            <svg className="shrink-0 text-text-faint" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                              type="text"
                              value={propertyQuery}
                              onChange={(e) => setPropertyQuery(e.target.value)}
                              placeholder="Buscar dirección, zona o ciudad…"
                              className="h-full w-full bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
                            />
                          </div>
                          <div className="mt-2 flex max-h-44 flex-col overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
                            {filteredProperties.length === 0 ? (
                              <p className="px-3 py-4 text-center text-[12.5px] text-text-faint">
                                Sin coincidencias
                              </p>
                            ) : (
                              filteredProperties.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setPropertyId(p.id)}
                                  className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-colors hover:bg-bg"
                                >
                                  <span className="line-clamp-1 text-[13.5px] font-bold text-text">{p.address}</span>
                                  <span className="line-clamp-1 text-[11.5px] text-text-faint">
                                    {[p.zone, p.city, p.operationType].filter(Boolean).join(" · ")}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <label htmlFor="firma-title" className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Título <span className="text-text-faint">(opcional)</span>
                      </label>
                      <input
                        id="firma-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Propuesta de Juan Pérez"
                        className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="firma-description" className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">
                        Descripción <span className="text-text-faint">(opcional)</span>
                      </label>
                      <textarea
                        id="firma-description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detalles de la propuesta, monto, condiciones…"
                        className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[12.5px] font-semibold text-text-muted">
                        Adjuntos <span className="text-text-faint">(imágenes, audios, videos, archivos)</span>
                      </label>
                      <MediaUploader
                        attachments={attachments}
                        onChange={setAttachments}
                        signedUrls={signedUrls}
                      />
                    </div>
                  </div>
                </div>
    </Sheet>
  );
}

function serializeFromApi(raw: unknown): SerializedFirma {
  // Reuse pattern from detail-modal — separated to avoid circular import.
  const r = raw as Record<string, unknown>;
  const property = r.property as Record<string, unknown>;
  const createdBy = r.createdByUser as Record<string, unknown>;
  const actions = ((r.actions as unknown[]) ?? []).map((a) => {
    const ar = a as Record<string, unknown>;
    const u = ar.createdByUser as Record<string, unknown>;
    return {
      id: ar.id as string,
      type: ar.type as SerializedFirma["actions"][number]["type"],
      fromStatus: (ar.fromStatus as SerializedFirma["status"] | null) ?? null,
      toStatus: (ar.toStatus as SerializedFirma["status"] | null) ?? null,
      dateField: (ar.dateField as string | null) ?? null,
      description: (ar.description as string | null) ?? null,
      attachments: Array.isArray(ar.attachments) ? (ar.attachments as Attachment[]) : [],
      createdByUser: {
        id: u.id as string,
        email: u.email as string,
        fullName: (u.fullName as string | null) ?? null,
        avatarUrl: (u.avatarUrl as string | null | undefined) ?? null,
      },
      createdAt: new Date(ar.createdAt as string).toISOString(),
    };
  });
  return {
    id: r.id as string,
    property: {
      id: property.id as string,
      address: property.address as string,
      city: (property.city as string | null) ?? null,
      zone: (property.zone as string | null) ?? null,
      type: (property.type as string | null) ?? null,
      status: property.status as string,
      operationType: (property.operationType as string | null) ?? null,
      coverImageUrl: (property.coverImageUrl as string | null) ?? null,
    },
    status: r.status as SerializedFirma["status"],
    title: (r.title as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    attachments: Array.isArray(r.attachments) ? (r.attachments as Attachment[]) : [],
    dateProcessStarted: r.dateProcessStarted ? new Date(r.dateProcessStarted as string).toISOString() : null,
    dateAgreed: r.dateAgreed ? new Date(r.dateAgreed as string).toISOString() : null,
    dateKeysHandover: r.dateKeysHandover ? new Date(r.dateKeysHandover as string).toISOString() : null,
    visitInformesId: (r.visitInformesId as string | null) ?? null,
    visitAcordadaId: (r.visitAcordadaId as string | null) ?? null,
    visitEntregaId: (r.visitEntregaId as string | null) ?? null,
    createdByUser: {
      id: createdBy.id as string,
      email: createdBy.email as string,
      fullName: (createdBy.fullName as string | null) ?? null,
      avatarUrl: (createdBy.avatarUrl as string | null | undefined) ?? null,
    },
    actions,
    createdAt: new Date(r.createdAt as string).toISOString(),
    updatedAt: new Date(r.updatedAt as string).toISOString(),
  };
}
