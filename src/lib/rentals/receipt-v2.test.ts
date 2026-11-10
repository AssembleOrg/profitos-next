import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { parseReceiptLayout, renderReceiptPdf, type ReceiptPdfInput } from "./receipt-v2";

const input: ReceiptPdfInput = {
  kind: "inquilino",
  pointOfSale: 1,
  number: 123,
  issuedAt: new Date("2026-11-10T15:00:00Z"),
  currency: "USD",
  amount: 1200,
  lines: [{ kind: "rent", label: "Alquiler", amount: 1200 }],
  feeAmount: 60,
  feePercent: 5,
  periodLabel: "Noviembre 2026",
  owner: { fullName: "Olga Dueña", idType: "dni", idNumber: "11111111" },
  tenant: { fullName: "Ignacio Inquilino", idType: "dni", idNumber: "22222222" },
  property: { address: "Mitre 913", unit: "2 B", city: "Quilmes", zone: "Centro", type: "departamento" },
};

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPages();

test("el recibo guardado (portal) sigue siendo de una sola hoja A5", async () => {
  const p = await pages(await renderReceiptPdf(input));
  assert.equal(p.length, 1);
  assert.deepEqual([Math.round(p[0].getWidth()), Math.round(p[0].getHeight())], [420, 595]);
});

test("dos hojas (por defecto en la oficina): original y copia, las dos A5", async () => {
  for (const kind of ["inquilino", "propietario"] as const) {
    const p = await pages(await renderReceiptPdf({ ...input, kind }, { layout: "dos-hojas" }));
    assert.equal(p.length, 2, kind);
    assert.equal(p[0].getWidth(), p[1].getWidth());
    assert.equal(p[0].getHeight(), p[1].getHeight());
  }
});

test("A4 apaisada: una sola hoja con las dos mitades", async () => {
  const p = await pages(await renderReceiptPdf(input, { layout: "a4" }));
  assert.equal(p.length, 1);
  assert.deepEqual([Math.round(p[0].getWidth()), Math.round(p[0].getHeight())], [842, 595]);
});

test("formato pedido por URL: solo a4 cambia el default", () => {
  assert.equal(parseReceiptLayout(null), "dos-hojas");
  assert.equal(parseReceiptLayout("cualquiera"), "dos-hojas");
  assert.equal(parseReceiptLayout("a4"), "a4");
});
