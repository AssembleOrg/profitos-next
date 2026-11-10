import { test } from "node:test";
import assert from "node:assert/strict";
import { splitCharges, type ChargeLine } from "./money";
import { correctionSummary, hoursSince, isLateCorrection, readCorrections, sameSnapshot, type PaymentSnapshot } from "./correction";

const snap = (lines: ChargeLine[], fee = 5, receiptNotes: string | null = null): PaymentSnapshot => ({ lines, split: splitCharges(lines, fee), receiptNotes });
const rent = (amount: number): ChargeLine => ({ kind: "rent", label: "Alquiler", amount });
const issued = new Date("2026-11-10T15:00:00Z");
const after = (hours: number, minutes = 0) => new Date(issued.getTime() + hours * 3_600_000 + minutes * 60_000);

test("las primeras 96 horas se corrige libre; un minuto después ya es fuera de plazo", () => {
  assert.equal(isLateCorrection(issued, after(0)), false);
  assert.equal(isLateCorrection(issued, after(95, 59)), false);
  assert.equal(isLateCorrection(issued, after(96)), false);
  assert.equal(isLateCorrection(issued, after(96, 1)), true);
  assert.equal(isLateCorrection(issued, after(24 * 30)), true);
});

test("horas desde la emisión, enteras y nunca negativas", () => {
  assert.equal(hoursSince(issued, after(0, 59)), 0);
  assert.equal(hoursSince(issued, after(97, 30)), 97);
  assert.equal(hoursSince(issued, new Date(issued.getTime() - 5000)), 0);
});

test("sin cambios reales no hay corrección", () => {
  const a = snap([rent(1200), { kind: "extra", label: "Expensas", amount: -100 }], 5, "nota");
  assert.equal(sameSnapshot(a, snap([rent(1200), { kind: "extra", label: " expensas ", amount: -100, affectsFee: false }], 5, " nota ")), true);
  assert.equal(sameSnapshot(a, snap([rent(1100), { kind: "extra", label: "Expensas", amount: -100 }], 5, "nota")), false);
  assert.equal(sameSnapshot(a, snap([rent(1200), { kind: "extra", label: "Expensas", amount: -100 }], 4, "nota")), false);
  assert.equal(sameSnapshot(a, snap([rent(1200), { kind: "extra", label: "Expensas", amount: -100 }], 5, "otra")), false);
  assert.equal(sameSnapshot(a, snap([rent(1200), { kind: "extra", label: "Expensas", amount: -100, affectsFee: true }], 5, "nota")), false);
  assert.equal(sameSnapshot(a, snap([rent(1200)], 5, "nota")), false);
});

test("resumen: baja el alquiler como excepción", () => {
  const s = correctionSummary({ before: snap([rent(1200)]), after: snap([rent(1100)]) }, "USD");
  assert.equal(s, "Total U$D 1.200,00 → U$D 1.100,00 · Alquiler U$D 1.200,00 → U$D 1.100,00 · neto propietario U$D 1.140,00 → U$D 1.045,00");
});

test("resumen: conceptos agregados, quitados, honorarios y observaciones", () => {
  const before = snap([rent(500000), { kind: "extra", label: "Punitorios", amount: 10000 }], 5, null);
  const next = snap([rent(500000), { kind: "extra", label: "Expensas", amount: -20000 }], 4.5, "ajuste");
  const s = correctionSummary({ before, after: next }, "ARS");
  assert.match(s, /^Total \$ 510\.000,00 → \$ 480\.000,00/);
  assert.match(s, /se agregó Expensas − \$ 20\.000,00/);
  assert.match(s, /se quitó Punitorios \$ 10\.000,00/);
  assert.match(s, /honorarios 5% → 4,5%/);
  assert.match(s, /cambiaron las observaciones$/);
  assert.doesNotMatch(s, /Alquiler/);
});

test("historial: tolera cobros sin correcciones y descarta entradas rotas", () => {
  assert.deepEqual(readCorrections(null), []);
  assert.deepEqual(readCorrections({ lines: [] }), []);
  const ok = { at: "2026-11-10T15:00:00.000Z", byUserId: "u", byName: "Juli", hoursAfterIssue: 1, late: false, reason: null, ownerAlreadyPaid: false, before: snap([rent(1)]), after: snap([rent(2)]) };
  assert.deepEqual(readCorrections({ corrections: [ok, null, { at: 3 }, { at: "x" }] }), [ok]);
});
