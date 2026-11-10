import { test } from "node:test";
import assert from "node:assert/strict";
import { monthSummary, pickPosting, trendLabel, vsSegment } from "./owner-stats-calc";

const p = (day: string, views: number) => ({ day, impressions: views * 10, views, leads: 0 });

test("mes en curso: suma hasta hoy y marca completo si están todos los días", () => {
  const pts = [p("2026-10-31", 9), p("2026-11-01", 2), p("2026-11-02", 3), p("2026-11-03", 4)];
  const m = monthSummary(pts, "2026-11", "2026-11-03");
  assert.equal(m.views, 9);
  assert.equal(m.impressions, 90);
  assert.equal(m.days, 3);
  assert.equal(m.complete, true);
  assert.equal(monthSummary(pts, "2026-11", "2026-11-04").complete, false);
});

test("mes anterior incompleto (empezamos a juntar a mitad de mes)", () => {
  const pts = [p("2026-10-12", 5), p("2026-10-31", 1)];
  const m = monthSummary(pts, "2026-10", "2026-11-10");
  assert.equal(m.views, 6);
  assert.equal(m.complete, false);
});

test("elige el aviso de la publicación, después el publicado con más visitas", () => {
  const rows = [
    { externalId: "a", fetchedAt: new Date(), totalVisits: 900 },
    { externalId: "b", fetchedAt: new Date(), totalVisits: 10 },
    { externalId: "c", fetchedAt: null, totalVisits: null },
  ];
  assert.equal(pickPosting(rows, "b", new Set())?.externalId, "b");
  assert.equal(pickPosting(rows, null, new Set(["b"]))?.externalId, "b");
  assert.equal(pickPosting(rows, null, new Set())?.externalId, "a");
  assert.equal(pickPosting([rows[2]], null, new Set())?.externalId, "c");
  assert.equal(pickPosting([], null, new Set()), null);
});

test("textos de tendencia y comparación (sin flechas: Helvetica del PDF no las tiene)", () => {
  assert.equal(trendLabel({ pct: 27.86, dir: "up" }), "+28 % vs. 30 días previos");
  assert.equal(trendLabel({ pct: 31.6, dir: "down" }), "-32 % vs. 30 días previos");
  assert.equal(trendLabel({ pct: 0, dir: "equal" }), "igual que los 30 días previos");
  assert.equal(trendLabel(undefined), null);
  assert.equal(vsSegment(179, 60.85)?.label, "2,9 veces el promedio");
  assert.equal(vsSegment(31, 78.41)?.label, "60 % debajo del promedio");
  assert.equal(vsSegment(60, 60)?.label, "en el promedio");
  assert.equal(vsSegment(5, 0), null);
});
