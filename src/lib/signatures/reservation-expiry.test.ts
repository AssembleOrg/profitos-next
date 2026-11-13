import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReservationReminderDates,
  calculateReservationExpiration,
  formatExpiryLong,
  previewExpiration,
  reminderDatesShort,
  resolveTerm,
} from "./reservation-expiry";

const day = (d: Date) => d.toISOString().slice(0, 10);

test("caso del video: 16/10/2026 + 60 días hábiles vence el viernes 15/01/2027", () => {
  // Feriados en el medio: 23/11 (Soberanía trasladado), 7/12 (puente), 8/12, 25/12 y 1/1.
  const expiry = calculateReservationExpiration("2026-10-16", 60, "business");
  assert.equal(day(expiry), "2027-01-15");
  assert.equal(formatExpiryLong(expiry), "viernes 15 de enero de 2027");
});

test("días corridos cuentan todo", () => {
  assert.equal(day(calculateReservationExpiration("2026-10-16", 30, "calendar")), "2026-11-15");
});

test("los avisos del refuerzo se marcan como refuerzo", () => {
  const expiry = new Date("2027-01-15T00:00:00.000Z");
  const reminders = buildReservationReminderDates(expiry, "refuerzo");
  assert.deepEqual(
    reminders.map((r) => [r.kind, r.offsetDays, day(r.scheduledFor)]),
    [
      ["refuerzo", 15, "2026-12-31"],
      ["refuerzo", 5, "2027-01-10"],
      ["refuerzo", 0, "2027-01-15"],
    ],
  );
  assert.equal(buildReservationReminderDates(expiry)[0].kind, "reserva");
  assert.deepEqual(reminderDatesShort(expiry), ["31/12", "10/01", "15/01"]);
});

test("resolveTerm valida y calcula", () => {
  const term = resolveTerm({ date: "2026-10-16", termDays: 60, dayType: "business" }, "el refuerzo");
  assert.equal(day(term.date), "2026-10-16");
  assert.equal(day(term.expiresAt), "2027-01-15");
  assert.throws(() => resolveTerm({ date: "", termDays: 60, dayType: "business" }, "el refuerzo"), { message: "Ingresá la fecha del refuerzo" });
  assert.throws(() => resolveTerm({ date: "2026-10-16", termDays: 0, dayType: "business" }, "el refuerzo"), /vigencia/);
  assert.throws(() => resolveTerm({ date: "2026-10-16", termDays: "60", dayType: "business" }, "el refuerzo"), /vigencia/);
  assert.throws(() => resolveTerm({ date: "2026-10-16", termDays: 60, dayType: "otro" }, "el refuerzo"), /hábiles o corridos/);
});

test("la vista previa espera a que estén los datos", () => {
  assert.equal(previewExpiration("", "60", "business"), null);
  assert.equal(previewExpiration("2026-10-16", "", "business"), null);
  assert.equal(previewExpiration("2026-10-16", "1.5", "business"), null);
  assert.equal(day(previewExpiration("2026-10-16", "60", "business")!), "2027-01-15");
});
