import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReservationReminderDates,
  calculateReservationExpiration,
  formatExpiryLong,
  previewExpiration,
  ruleHolidays,
  reminderDatesShort,
  resolveTerm,
} from "./reservation-expiry";

const day = (d: Date) => d.toISOString().slice(0, 10);

test("caso del video: 16/10/2026 + 60 días hábiles = martes 19/01/2027, igual que la calculadora del Colegio", () => {
  // Feriados en el medio (según el Colegio): 9/11 y 11/11 (visita del Papa), 23/11, 7/12, 8/12, 25/12 y 1/1.
  const expiry = calculateReservationExpiration("2026-10-16", 60, "business");
  assert.equal(day(expiry), "2027-01-19");
  assert.equal(formatExpiryLong(expiry), "martes 19 de enero de 2027");
});

test("reglas propias = criterio del Colegio: Jueves Santo sí, 14/8 (Quilmes) no", () => {
  const y2027 = ruleHolidays(2027);
  assert.ok(y2027.has("2027-03-25"), "Jueves Santo 2027");
  assert.ok(y2027.has("2027-06-21"), "Güemes 17/6 (jueves) pasa al lunes 21");
  assert.ok(y2027.has("2027-08-16"), "San Martín 17/8 (martes) pasa al lunes 16");
  assert.ok(y2027.has("2027-10-11"), "12/10 (martes) pasa al lunes 11");
  assert.ok(ruleHolidays(2025).has("2025-04-17"), "Jueves Santo 2025");
  assert.ok(!ruleHolidays(2026).has("2026-08-14"), "el Día de Quilmes no lo cuenta el Colegio");
  // Lista 2026 completa que devuelve el Colegio.
  const colegio2026 = [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-23", "2026-03-24", "2026-04-02", "2026-04-03",
    "2026-05-01", "2026-05-25", "2026-06-15", "2026-06-20", "2026-07-09", "2026-07-10", "2026-08-17",
    "2026-10-12", "2026-11-09", "2026-11-11", "2026-11-23", "2026-12-07", "2026-12-08", "2026-12-25",
  ];
  assert.deepEqual([...ruleHolidays(2026)].sort(), colegio2026);
});

test("los feriados bajados del Colegio mandan dentro de su rango", () => {
  // Un feriado nuevo (inventado) el 2/11 corre el vencimiento un día hábil.
  const calendar = { from: "2026-11-01", to: "2026-12-31", days: ["2026-11-02", "2026-11-09", "2026-11-11", "2026-11-23", "2026-12-07", "2026-12-08", "2026-12-25"] };
  assert.equal(day(calculateReservationExpiration("2026-10-30", 5, "business")), "2026-11-06");
  assert.equal(day(calculateReservationExpiration("2026-10-30", 5, "business", calendar)), "2026-11-10");
  // Si el Colegio saca un feriado (11/11 deja de estar), vuelve a contarse.
  const sinElOnce = { ...calendar, days: calendar.days.filter((d) => d !== "2026-11-11") };
  assert.equal(day(calculateReservationExpiration("2026-11-06", 3, "business", sinElOnce)), "2026-11-12");
  assert.equal(day(calculateReservationExpiration("2026-11-06", 3, "business")), "2026-11-13");
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
  assert.equal(day(term.expiresAt), "2027-01-19");
  assert.throws(() => resolveTerm({ date: "", termDays: 60, dayType: "business" }, "el refuerzo"), { message: "Ingresá la fecha del refuerzo" });
  assert.throws(() => resolveTerm({ date: "2026-10-16", termDays: 0, dayType: "business" }, "el refuerzo"), /vigencia/);
  assert.throws(() => resolveTerm({ date: "2026-10-16", termDays: "60", dayType: "business" }, "el refuerzo"), /vigencia/);
  assert.throws(() => resolveTerm({ date: "2026-10-16", termDays: 60, dayType: "otro" }, "el refuerzo"), /hábiles o corridos/);
});

test("la vista previa espera a que estén los datos", () => {
  assert.equal(previewExpiration("", "60", "business"), null);
  assert.equal(previewExpiration("2026-10-16", "", "business"), null);
  assert.equal(previewExpiration("2026-10-16", "1.5", "business"), null);
  assert.equal(day(previewExpiration("2026-10-16", "60", "business")!), "2027-01-19");
});
