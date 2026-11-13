import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateOnly } from "./datetime";

test("fecha pura: string ISO y Date muestran el mismo día (sin correrse a GMT-3)", () => {
  assert.equal(formatDateOnly("2027-01-15T00:00:00.000Z"), "15/01/2027");
  assert.equal(formatDateOnly(new Date("2027-01-15T00:00:00.000Z")), "15/01/2027");
  assert.equal(formatDateOnly("2026-12-01"), "01/12/2026");
});
