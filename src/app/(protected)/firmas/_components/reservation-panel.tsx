"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatExpiryLong } from "@/lib/signatures/reservation-expiry";
import type { SerializedFirma } from "./types";
import { serializeFromApi } from "./serialize";
import {
  CALENDAR_HINT,
  CalendarCheck,
  calendarFailedMessage,
  ExpiryPreview,
  ReinforcementToggle,
  sameTerm,
  TermFields,
  termError,
  termFromFirma,
  type TermDraft,
} from "./vigencia-fields";

type Busy = null | "reserva" | "refuerzo" | "cal-reserva" | "cal-refuerzo";

export function ReservationPanel({
  firma,
  onUpdated,
}: Readonly<{ firma: SerializedFirma; onUpdated: (firma: SerializedFirma) => void }>) {
  const savedReservation = termFromFirma(firma.reservationDate, firma.reservationTermDays, firma.reservationDayType);
  const savedReinforcement = termFromFirma(firma.reinforcementDate, firma.reinforcementTermDays, firma.reinforcementDayType);

  const [reservation, setReservation] = useState<TermDraft>(savedReservation);
  const [withReinforcement, setWithReinforcement] = useState(firma.hasReinforcement);
  const [reinforcement, setReinforcement] = useState<TermDraft>(savedReinforcement);
  const [busy, setBusy] = useState<Busy>(null);

  useEffect(() => {
    setReservation(termFromFirma(firma.reservationDate, firma.reservationTermDays, firma.reservationDayType));
    setWithReinforcement(firma.hasReinforcement);
    setReinforcement(termFromFirma(firma.reinforcementDate, firma.reinforcementTermDays, firma.reinforcementDayType));
  }, [
    firma.id,
    firma.reservationDate,
    firma.reservationTermDays,
    firma.reservationDayType,
    firma.hasReinforcement,
    firma.reinforcementDate,
    firma.reinforcementTermDays,
    firma.reinforcementDayType,
  ]);

  const reservationDirty = !sameTerm(reservation, savedReservation);
  const reinforcementDirty =
    withReinforcement !== firma.hasReinforcement ||
    (withReinforcement && !sameTerm(reinforcement, savedReinforcement));

  async function patch(kind: Exclude<Busy, null>, payload: Record<string, unknown>, success: string) {
    setBusy(kind);
    try {
      const res = await fetch(`/api/firmas/${firma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Error");
      onUpdated(serializeFromApi(body.data));
      const calendarProblem = calendarFailedMessage(body.data?.calendarFailed);
      if (calendarProblem) toast.warning(calendarProblem, { duration: 10000 });
      else toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  }

  function saveReservation() {
    const problem = termError(reservation, "la reserva");
    if (problem) return toast.error(problem);
    void patch(
      "reserva",
      {
        reservationDate: reservation.date,
        reservationTermDays: Number(reservation.termDays),
        reservationDayType: reservation.dayType,
      },
      "Vigencia recalculada",
    );
  }

  function saveReinforcement() {
    if (!withReinforcement) {
      void patch("refuerzo", { hasReinforcement: false }, "Refuerzo quitado");
      return;
    }
    const problem = termError(reinforcement, "el refuerzo");
    if (problem) return toast.error(problem);
    void patch(
      "refuerzo",
      {
        hasReinforcement: true,
        reinforcementDate: reinforcement.date,
        reinforcementTermDays: Number(reinforcement.termDays),
        reinforcementDayType: reinforcement.dayType,
      },
      "Refuerzo guardado",
    );
  }

  const disabled = busy !== null;

  return (
    <section className="rounded-[16px] bg-sand-chip p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Vigencia de la reserva</h4>
          <p className="mt-1 text-[13px] font-bold text-text">
            {firma.reservationExpiresAt
              ? `Vigente hasta el ${formatExpiryLong(firma.reservationExpiresAt)}`
              : "Completá los datos de la reserva"}
          </p>
          {firma.hasReinforcement && firma.reinforcementExpiresAt && (
            <p className="mt-0.5 text-[12px] font-semibold text-text-muted">
              Refuerzo hasta el {formatExpiryLong(firma.reinforcementExpiresAt)}
            </p>
          )}
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-text-muted">
          Avisos: 15 días · 5 días · vencimiento
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <TermFields
          idPrefix={`firma-${firma.id}-reservation`}
          value={reservation}
          onChange={setReservation}
          dateLabel="Fecha de reserva"
          disabled={disabled}
        />
        {reservationDirty && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <ExpiryPreview term={reservation} what="la reserva" />
            </div>
            <SaveButton onClick={saveReservation} busy={busy === "reserva"} disabled={disabled} label="Recalcular" />
          </div>
        )}
        <CalendarCheck
          checked={firma.reservationOnCalendar}
          onChange={(next) =>
            void patch("cal-reserva", { reservationCalendar: next }, next ? "Vencimiento agendado en Google Calendar" : "Sacado de Google Calendar")
          }
          disabled={disabled || !firma.reservationExpiresAt}
          label={busy === "cal-reserva" ? "Guardando…" : "Vencimiento de la reserva en Google Calendar"}
          hint={CALENDAR_HINT}
        />

        <div className="mt-1 flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-[12.5px] font-bold text-text">¿Con refuerzo?</p>
          <ReinforcementToggle value={withReinforcement} onChange={setWithReinforcement} disabled={disabled} />
          {withReinforcement && (
            <>
              <TermFields
                idPrefix={`firma-${firma.id}-reinforcement`}
                value={reinforcement}
                onChange={setReinforcement}
                dateLabel="Fecha del refuerzo"
                disabled={disabled}
              />
              <ExpiryPreview term={reinforcement} what="el refuerzo" />
            </>
          )}
          {reinforcementDirty && (
            <div className="flex justify-end">
              <SaveButton
                onClick={saveReinforcement}
                busy={busy === "refuerzo"}
                disabled={disabled}
                label={withReinforcement ? "Guardar refuerzo" : "Quitar refuerzo"}
              />
            </div>
          )}
          {firma.hasReinforcement && !reinforcementDirty && (
            <CalendarCheck
              checked={firma.reinforcementOnCalendar}
              onChange={(next) =>
                void patch("cal-refuerzo", { reinforcementCalendar: next }, next ? "Refuerzo agendado en Google Calendar" : "Sacado de Google Calendar")
              }
              disabled={disabled}
              label={busy === "cal-refuerzo" ? "Guardando…" : "Vencimiento del refuerzo en Google Calendar"}
            />
          )}
        </div>
      </div>
      <p className="mt-3 text-[10.5px] text-text-faint">
        Los días hábiles excluyen fines de semana, feriados nacionales, días no laborables con fines turísticos y el 14 de agosto (Día de Quilmes).
      </p>
    </section>
  );
}

function SaveButton({
  onClick,
  busy,
  disabled,
  label,
}: Readonly<{ onClick: () => void; busy: boolean; disabled: boolean; label: string }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 shrink-0 rounded-full bg-dark px-4 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? "Guardando…" : label}
    </button>
  );
}
