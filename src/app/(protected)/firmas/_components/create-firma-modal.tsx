"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import type { Attachment } from "@/lib/signatures";
import { MediaUploader } from "./media-uploader";
import { useSignedUrls } from "./use-signed-urls";
import type { SerializedFirma } from "./types";
import { serializeFromApi } from "./serialize";
import {
  ColleagueFields,
  colleaguePayload,
  EMPTY_COLLEAGUE,
  EMPTY_OPERATION,
  OperationFields,
  operationPayload,
  type ColleagueDraft,
  type OperationDraft,
} from "./colleague-fields";
import {
  CALENDAR_HINT,
  CalendarCheck,
  calendarFailedMessage,
  EMPTY_TERM,
  ExpiryPreview,
  ReinforcementToggle,
  TermFields,
  termError,
  type TermDraft,
} from "./vigencia-fields";

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
  // Inmueble no publicado (cartera de un colega): solo se escribe la dirección.
  const [manualAddress, setManualAddress] = useState<string | null>(null);
  const [colleague, setColleague] = useState<ColleagueDraft>(EMPTY_COLLEAGUE);
  const [operation, setOperation] = useState<OperationDraft>(EMPTY_OPERATION);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reservation, setReservation] = useState<TermDraft>(EMPTY_TERM);
  const [reservationCalendar, setReservationCalendar] = useState(false);
  const [hasReinforcement, setHasReinforcement] = useState(false);
  const [reinforcement, setReinforcement] = useState<TermDraft>(EMPTY_TERM);
  const [reinforcementCalendar, setReinforcementCalendar] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const paths = attachments.map((a) => a.path);
  const { urls: signedUrls } = useSignedUrls(paths);

  useEffect(() => {
    if (!open) return;
    setPropertyId(initialPropertyId ?? "");
    setPropertyQuery("");
    setManualAddress(null);
    setColleague(EMPTY_COLLEAGUE);
    setOperation(EMPTY_OPERATION);
    setTitle("");
    setDescription("");
    setReservation(EMPTY_TERM);
    setReservationCalendar(false);
    setHasReinforcement(false);
    setReinforcement(EMPTY_TERM);
    setReinforcementCalendar(false);
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
    const isManual = manualAddress !== null;
    if (!isManual && !propertyId) {
      toast.error("Seleccioná una propiedad");
      return;
    }
    if (isManual && !manualAddress.trim()) {
      toast.error("Escribí la dirección del inmueble");
      return;
    }
    const colleagueData = colleaguePayload(colleague);
    if (typeof colleagueData === "string") {
      toast.error(colleagueData);
      return;
    }
    const operationData = operationPayload(operation);
    if (typeof operationData === "string") {
      toast.error(operationData);
      return;
    }
    const reservationProblem = termError(reservation, "la reserva");
    if (reservationProblem) {
      toast.error(reservationProblem);
      return;
    }
    const reinforcementProblem = hasReinforcement ? termError(reinforcement, "el refuerzo") : null;
    if (reinforcementProblem) {
      toast.error(reinforcementProblem);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/firmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isManual ? { newPropertyAddress: manualAddress.trim() } : { propertyId }),
          ...colleagueData,
          ...operationData,
          title: title.trim() || null,
          description: description.trim() || null,
          attachments,
          reservationDate: reservation.date,
          reservationTermDays: Number(reservation.termDays),
          reservationDayType: reservation.dayType,
          reservationCalendar,
          hasReinforcement,
          ...(hasReinforcement && {
            reinforcementDate: reinforcement.date,
            reinforcementTermDays: Number(reinforcement.termDays),
            reinforcementDayType: reinforcement.dayType,
            reinforcementCalendar,
          }),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onCreated(serializeFromApi(body.data));
      const calendarProblem = calendarFailedMessage(body.data?.calendarFailed);
      if (calendarProblem) toast.warning(calendarProblem, { duration: 10000 });
      else toast.success(reservationCalendar || (hasReinforcement && reinforcementCalendar)
        ? "Propuesta creada y agendada en Google Calendar"
        : "Propuesta creada");
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
                        {manualAddress !== null && (
                          <button
                            type="button"
                            onClick={() => setManualAddress(null)}
                            className="text-[12.5px] font-bold text-terra transition-opacity hover:opacity-80"
                          >
                            Elegir una publicada
                          </button>
                        )}
                        {selectedProperty && manualAddress === null && (
                          <button
                            type="button"
                            onClick={() => setPropertyId("")}
                            className="text-[12.5px] font-bold text-terra transition-opacity hover:opacity-80"
                          >
                            Cambiar
                          </button>
                        )}
                      </label>
                      {manualAddress !== null ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text"
                            value={manualAddress}
                            onChange={(e) => setManualAddress(e.target.value)}
                            placeholder="Calle y número, piso/depto"
                            aria-label="Dirección del inmueble"
                            autoFocus
                            className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                          />
                          <p className="text-[11.5px] text-text-faint">
                            No se publica ni aparece en Propiedades: queda solo para esta firma.
                          </p>
                        </div>
                      ) : selectedProperty ? (
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
                          <button
                            type="button"
                            onClick={() => {
                              setManualAddress(propertyQuery.trim());
                              setPropertyId("");
                              // Si no está publicada, casi siempre la tiene un colega.
                              setColleague((c) => ({ ...c, withColleague: true }));
                            }}
                            className="mt-2 text-[12.5px] font-bold text-olive-light transition-opacity hover:opacity-80"
                          >
                            + No está publicada (la tiene un colega): escribir la dirección
                          </button>
                        </>
                      )}
                    </div>

                    <div className="rounded-[16px] bg-bg p-4">
                      <div className="mb-3">
                        <p className="text-[12.5px] font-bold text-text">Operación y honorarios</p>
                        <p className="mt-0.5 text-[11.5px] text-text-faint">
                          Si la operación es compartida, indicá con quién y qué % de nuestros honorarios le corresponde.
                        </p>
                      </div>
                      <div className="flex flex-col gap-4">
                        <ColleagueFields value={colleague} onChange={setColleague} />
                        <OperationFields value={operation} onChange={setOperation} colleague={colleague} />
                      </div>
                    </div>

                    <div className="rounded-[16px] bg-bg p-4">
                      <div className="mb-3">
                        <p className="text-[12.5px] font-bold text-text">Vigencia de la reserva</p>
                        <p className="mt-0.5 text-[11.5px] text-text-faint">
                          El vencimiento se calcula solo (los días hábiles no cuentan fines de semana ni feriados) y se avisa 15 días antes, 5 días antes y el día del vencimiento.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        <TermFields
                          idPrefix="firma-reservation"
                          value={reservation}
                          onChange={setReservation}
                          dateLabel="Fecha de reserva"
                        />
                        <ExpiryPreview term={reservation} what="la reserva" />
                        <CalendarCheck
                          checked={reservationCalendar}
                          onChange={setReservationCalendar}
                          label="Agendar el vencimiento de la reserva en mi Google Calendar"
                          hint={CALENDAR_HINT}
                        />

                        <div className="mt-1 border-t border-border pt-4">
                          <p className="mb-2 text-[12.5px] font-bold text-text">¿Con refuerzo?</p>
                          <ReinforcementToggle value={hasReinforcement} onChange={setHasReinforcement} />
                        </div>

                        {hasReinforcement && (
                          <>
                            <TermFields
                              idPrefix="firma-reinforcement"
                              value={reinforcement}
                              onChange={setReinforcement}
                              dateLabel="Fecha del refuerzo"
                            />
                            <ExpiryPreview term={reinforcement} what="el refuerzo" />
                            <CalendarCheck
                              checked={reinforcementCalendar}
                              onChange={setReinforcementCalendar}
                              label="Agendar el vencimiento del refuerzo en mi Google Calendar"
                            />
                          </>
                        )}
                      </div>
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

