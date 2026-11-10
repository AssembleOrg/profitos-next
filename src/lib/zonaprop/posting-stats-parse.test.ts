import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAnyStat, parseDaily, parseTrend, parseWeekly, parseZpPostingStats } from "./posting-stats-parse";

// Respuestas reales del panel de ZonaProp (aviso 60067864, 10/11/2026), recortadas.
const statistic = {
  impression: { total: 2841, percentage: 15.16, status: "ALTO" },
  visit: { total: 179, percentage: 27.86, status: "ALTO" },
  leads: { total: 2, percentage: 0, status: "EQUAL" },
  "user-stat": { total: 3, percentage: 50, status: "ALTO" },
  "anonymous-stat": { total: 0, percentage: null, status: null },
  userStats: { leadForm: 1, socialAds: 0, total: 3, viewData: 0, whatsapp: 2, totalAnonymous: 0 },
};
const daily = {
  impressions: { "2026-11-09": 78, "2026-11-08": 69, "2026-11-10": 46 },
  views: { "2026-11-08": 5, "2026-11-09": 4, "2026-11-10": 2 },
  leads: { "2026-11-08": 0, "2026-11-09": 1, "2026-11-10": 0 },
  userStat: { "2026-11-08": 0 },
  period: null,
};
const performance = {
  impressions: 2841,
  visits: 179,
  leads: 3,
  "segment-impressions": 846.06,
  "segment-visits": 60.85,
  "segment-leads": 1.54,
};

test("parsea las 6 respuestas del panel", () => {
  const s = parseZpPostingStats({ statistic, daily, performance, visits: 370, impressions: 6112, leads: { total: 5, unread: 0 } });
  assert.equal(s.totalVisits, 370);
  assert.equal(s.totalImpressions, 6112);
  assert.equal(s.totalLeads, 5);
  assert.equal(s.visits30, 179);
  assert.equal(s.impressions30, 2841);
  assert.equal(s.leads30, 2);
  assert.equal(s.contacts30, 3);
  assert.deepEqual(s.contactsByChannel, { whatsapp: 2, leadForm: 1, viewData: 0, socialAds: 0 });
  assert.deepEqual(s.trend?.visits, { pct: 27.86, dir: "up" });
  assert.deepEqual(s.trend?.leads, { pct: 0, dir: "equal" });
  assert.deepEqual(s.segment, { impressions: 846.06, visits: 60.85, leads: 1.54 });
  assert.equal(s.periodFrom, "2026-11-08");
  assert.equal(s.periodTo, "2026-11-10");
  assert.deepEqual(s.daily.map((d) => d.day), ["2026-11-08", "2026-11-09", "2026-11-10"]);
  assert.equal(s.daily[1].leads, 1);
});

test("aviso nuevo: sin período previo no hay tendencia", () => {
  const s = parseZpPostingStats({
    statistic: { impression: { total: 726, percentage: null, status: null }, visit: { total: 31, percentage: null, status: null } },
  });
  assert.equal(s.visits30, 31);
  assert.equal(s.trend, null);
});

test("tolera respuestas faltantes o vacías", () => {
  const s = parseZpPostingStats({});
  assert.equal(hasAnyStat(s), false);
  assert.equal(s.visits30, null);
  assert.deepEqual(s.daily, []);
  // sin "statistic", cae a performance y después a la suma diaria
  const t = parseZpPostingStats({ daily });
  assert.equal(t.visits30, 11);
  assert.equal(t.impressions30, 193);
  assert.equal(hasAnyStat(t), true);
});

test("tendencia: BAJO se pasa a caída real (ZP la da relativa al valor actual)", () => {
  // aviso 51346853: 128 visitas, "83,59 % BAJO" → antes ~235 → cayó ~45 %
  assert.deepEqual(parseTrend({ total: 128, percentage: 83.59, status: "BAJO" }), { pct: 45.53, dir: "down" });
  assert.deepEqual(parseTrend({ total: 79, percentage: 31.65, status: "BAJO" }), { pct: 24.04, dir: "down" });
  assert.equal(parseTrend({ total: 1, percentage: null, status: null }), undefined);
  assert.equal(parseTrend(null), undefined);
});

test("serie diaria ignora claves que no son fechas", () => {
  assert.deepEqual(parseDaily({ views: { "2026-11-01": 3, total: 9 } }), [{ day: "2026-11-01", impressions: 0, views: 3, leads: 0 }]);
  assert.deepEqual(parseDaily("x"), []);
});

test("serie semanal de 90 días (clave = fin del período)", () => {
  const weekly = {
    views: { "2026-11-03": 32, "2026-11-10": 29 },
    impressions: { "2026-11-03": 337, "2026-11-10": 267 },
    leads: { "2026-11-10": 1 },
    period: [
      { startPeriod: "2026-11-04", endPeriod: "2026-11-10" },
      { startPeriod: "2026-10-28", endPeriod: "2026-11-03" },
      { startPeriod: "mal", endPeriod: "2026-11-11" },
    ],
  };
  assert.deepEqual(parseWeekly(weekly), [
    { from: "2026-10-28", to: "2026-11-03", impressions: 337, views: 32, leads: 0 },
    { from: "2026-11-04", to: "2026-11-10", impressions: 267, views: 29, leads: 1 },
  ]);
  assert.deepEqual(parseWeekly({ period: null }), []);
  assert.equal(parseZpPostingStats({ weekly }).weekly.length, 2);
});
