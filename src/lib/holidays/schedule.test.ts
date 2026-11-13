import { test } from "node:test";
import assert from "node:assert/strict";
import { mondayHolidaysDue } from "./schedule";
import { currentAndNextMonth } from "./colegio";

test("corre los lunes desde las 8 (AR) y una sola vez", () => {
  const lunes9 = new Date("2026-11-16T12:00:00Z"); // lunes 9:00 AR
  const lunes7 = new Date("2026-11-16T10:00:00Z"); // lunes 7:00 AR
  const martes = new Date("2026-11-17T12:00:00Z");
  assert.equal(mondayHolidaysDue(lunes9, null), true);
  assert.equal(mondayHolidaysDue(lunes7, null), false);
  assert.equal(mondayHolidaysDue(martes, null), false);
  assert.equal(mondayHolidaysDue(lunes9, new Date("2026-11-09T12:00:00Z")), true, "la del lunes anterior no cuenta");
  assert.equal(mondayHolidaysDue(lunes9, new Date("2026-11-16T11:05:00Z")), false, "ya corrió hoy a las 8:05");
});

test("rango: mes actual y el siguiente", () => {
  assert.deepEqual(currentAndNextMonth("2026-11-13"), { from: "2026-11-01", to: "2026-12-31" });
  assert.deepEqual(currentAndNextMonth("2026-12-07"), { from: "2026-12-01", to: "2027-01-31" });
  assert.deepEqual(currentAndNextMonth("2027-01-31"), { from: "2027-01-01", to: "2027-02-28" });
});
