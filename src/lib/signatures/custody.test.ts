import { test } from "node:test";
import assert from "node:assert/strict";
import { custodyEnvelopes, describeCustody, parseEnvelopeAmount } from "./custody";

test("caso del audio: reserva US$1.000 (sobre 1) + refuerzo US$2.000 (sobre 2) = US$3.000", () => {
  const envs = custodyEnvelopes({
    reservationAmount: 1000,
    reservationCurrency: "USD",
    hasReinforcement: true,
    reinforcementAmount: 2000,
    reinforcementCurrency: "USD",
  });
  assert.deepEqual(envs.map((e) => [e.number, e.kind, e.amount]), [[1, "reserva", 1000], [2, "refuerzo", 2000]]);
  assert.equal(describeCustody(envs), "2 sobres · US$ 3.000");
});

test("sin refuerzo solo cuenta el sobre de la reserva", () => {
  const envs = custodyEnvelopes({
    reservationAmount: 1000,
    reservationCurrency: "USD",
    hasReinforcement: false,
    reinforcementAmount: 2000,
    reinforcementCurrency: "USD",
  });
  assert.equal(describeCustody(envs), "1 sobre · US$ 1.000");
});

test("monedas mezcladas se suman por separado", () => {
  const envs = custodyEnvelopes({
    reservationAmount: 1000,
    reservationCurrency: "USD",
    hasReinforcement: true,
    reinforcementAmount: 500000,
    reinforcementCurrency: "ARS",
  });
  assert.equal(describeCustody(envs), "2 sobres · US$ 1.000 + $ 500.000");
});

test("montos: vacío = null, inválido = error", () => {
  assert.equal(parseEnvelopeAmount("", "de la reserva"), null);
  assert.equal(parseEnvelopeAmount(null, "de la reserva"), null);
  assert.equal(parseEnvelopeAmount(0, "de la reserva"), null);
  assert.equal(parseEnvelopeAmount("1500,5", "de la reserva"), 1500.5);
  assert.throws(() => parseEnvelopeAmount(-1, "de la reserva"), { message: "El monto de la reserva no es válido" });
  assert.throws(() => parseEnvelopeAmount("abc", "del refuerzo"), { message: "El monto del refuerzo no es válido" });
});
