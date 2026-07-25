"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[min(640px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
              >
                <header className="flex items-center justify-between gap-3 border-b border-border-olive/40 px-5 py-4">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-text">
                      Nueva propuesta
                    </Dialog.Title>
                    <Dialog.Description className="mt-0.5 text-xs text-text-muted">
                      Iniciá un proceso de firma adjuntando lo necesario.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-bg hover:text-text"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </Dialog.Close>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="flex flex-col gap-5">
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-muted">
                        <span>Propiedad</span>
                        {selectedProperty && (
                          <button
                            type="button"
                            onClick={() => setPropertyId("")}
                            className="text-[10px] font-medium normal-case tracking-normal text-text-faint hover:text-text"
                          >
                            Cambiar
                          </button>
                        )}
                      </label>
                      {selectedProperty ? (
                        <div className="flex items-center justify-between rounded-xl border border-olive-bright/30 bg-olive-subtle px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text">{selectedProperty.address}</p>
                            <p className="truncate text-[11px] text-text-muted">
                              {[selectedProperty.zone, selectedProperty.city, selectedProperty.operationType]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={propertyQuery}
                            onChange={(e) => setPropertyQuery(e.target.value)}
                            placeholder="Buscar dirección, zona o ciudad…"
                            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
                          />
                          <div className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-bg/40 p-1.5">
                            {filteredProperties.length === 0 ? (
                              <p className="px-3 py-3 text-center text-xs text-text-muted">
                                Sin coincidencias
                              </p>
                            ) : (
                              filteredProperties.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setPropertyId(p.id)}
                                  className="flex w-full flex-col items-start rounded-lg border border-transparent px-2.5 py-1.5 text-left transition-colors hover:border-olive-bright/40 hover:bg-bg"
                                >
                                  <span className="line-clamp-1 text-sm text-text">{p.address}</span>
                                  <span className="line-clamp-1 text-[11px] text-text-faint">
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
                      <label htmlFor="firma-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Título <span className="text-text-faint">(opcional)</span>
                      </label>
                      <input
                        id="firma-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Propuesta de Juan Pérez"
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="firma-description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Descripción <span className="text-text-faint">(opcional)</span>
                      </label>
                      <textarea
                        id="firma-description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detalles de la propuesta, monto, condiciones…"
                        className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
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

                <footer className="flex items-center justify-end gap-2 border-t border-border bg-bg/30 px-5 py-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-xl border border-border bg-bg px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="rounded-xl border border-olive-bright/30 bg-olive-mid px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(143,168,112,0.15),0_8px_24px_-8px_rgba(143,168,112,0.5)] transition-colors hover:bg-olive-vivid disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Creando…" : "Crear propuesta"}
                  </button>
                </footer>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
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
