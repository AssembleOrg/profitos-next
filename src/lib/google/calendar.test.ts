import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAllDayEventBody } from "./calendar";

test("vencimiento = evento de día completo con fin exclusivo y avisos a las 9", () => {
  const body = buildAllDayEventBody({
    title: "Vence la reserva — Mitre 913",
    date: "2026-12-31",
    // 15 días, 5 días y el día anterior a las 9:00 (como arma reservation-calendar)
    reminderMinutes: [15 * 1440 - 540, 5 * 1440 - 540, 1440 - 540],
  });
  assert.deepEqual(body.start, { date: "2026-12-31" });
  assert.deepEqual(body.end, { date: "2027-01-01" });
  assert.equal(body.status, "confirmed");
  assert.deepEqual(body.reminders, {
    useDefault: false,
    overrides: [
      { method: "popup", minutes: 21060 },
      { method: "popup", minutes: 6660 },
      { method: "popup", minutes: 900 },
    ],
  });
});

test("descarta recordatorios fuera del rango de Google (máx. 4 semanas)", () => {
  const body = buildAllDayEventBody({ title: "x", date: "2027-01-15", reminderMinutes: [50000, -5] });
  assert.deepEqual(body.reminders, { useDefault: true });
});
