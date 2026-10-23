// Migra movimientos viejos de estados de cuenta al esquema nuevo:
// honorarios de la inmobiliaria (fee_percentage) separados de la comisión del
// agente (agent_percentage, % sobre el ingreso), que ahora se descuenta como egreso.
//
// Antes el único campo era agent_percentage y era informativo: en la práctica
// cargaban ahí el % de honorarios (ej. 3%) y el del agente iba en la descripción
// ("Se le cobró el 3%=720.000, a valen 20% (-144.000)").
//
// Uso (requiere la columna fee_percentage ya creada):
//   node scripts/migrar-comision-agente.mjs            → dry-run, solo muestra
//   node scripts/migrar-comision-agente.mjs --apply    → aplica en una transacción
//
// Reglas, solo ingresos con agente y comisión en %:
//   - agent_percentage <= 10 → era el honorario: pasa a fee_percentage.
//     El % del agente se busca en la descripción (otro % > 10). Si no hay, queda
//     null y se lista para revisar a mano (sin comisión no se descuenta nada).
//   - agent_percentage > 10 → ya era el % del agente: queda igual.
// Además lista egresos manuales a agentes que podrían duplicar la comisión.
import { createRequire } from "node:module";

// pg no es dependencia directa (pnpm): se toma el que trae @prisma/adapter-pg.
const require = createRequire(import.meta.url);
const pg = createRequire(require.resolve("@prisma/adapter-pg"))("pg");

const APPLY = process.argv.includes("--apply");
const FEE_MAX = 10;

const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await client.connect();

const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

function percentsIn(text) {
  return [...(text ?? "").matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => Number(m[1].replace(",", ".")));
}

const { rows } = await client.query(`
  SELECT e.id, e.amount, e.currency, e.date::text AS date, e.description,
         e.agent_percentage, e.fee_percentage, c.name AS category, u.full_name AS agent
  FROM profitos.jp_account_entries e
  LEFT JOIN profitos.jp_account_categories c ON c.id = e.category_id
  LEFT JOIN profitos.jp_users u ON u.id = e.agent_user_id
  WHERE e.type = 'income' AND e.agent_user_id IS NOT NULL
    AND e.agent_percentage IS NOT NULL AND e.agent_share_type = 'percent'
    AND e.fee_percentage IS NULL
  ORDER BY e.date`);

const updates = [];
const review = [];
for (const r of rows) {
  const current = Number(r.agent_percentage);
  if (current > FEE_MAX) {
    console.log(`= ${r.date} ${r.category} ${r.currency} ${fmt(r.amount)} · ${r.agent}: ${current}% ya es del agente`);
    continue;
  }
  const agentPct = percentsIn(r.description).find((p) => p > FEE_MAX) ?? null;
  updates.push({ id: r.id, fee: current, agent: agentPct });
  const line = `${r.date} ${r.category} ${r.currency} ${fmt(r.amount)} · ${r.agent}: honorarios ${current}%, agente ${agentPct ?? "?"}%`;
  if (agentPct == null) review.push(`${line} · "${r.description ?? ""}"`);
  else console.log(`→ ${line} (comisión ${fmt((r.amount * agentPct) / 100)})`);
}

if (review.length) {
  console.log(`\nSin % de agente en la descripción (quedan sin comisión, revisar a mano):`);
  for (const l of review) console.log(`? ${l}`);
}

const { rows: manualCommissions } = await client.query(`
  SELECT e.date::text AS date, e.currency, e.amount, e.description, c.name AS category, u.full_name AS agent
  FROM profitos.jp_account_entries e
  LEFT JOIN profitos.jp_account_categories c ON c.id = e.category_id
  LEFT JOIN profitos.jp_users u ON u.id = e.agent_user_id
  WHERE e.type = 'expense' AND (e.category_id = 'seed_agent_commission' OR c.name ILIKE '%agente%')
  ORDER BY e.date`);
if (manualCommissions.length) {
  console.log(`\nEgresos manuales a agentes (posible doble descuento con la comisión automática):`);
  for (const r of manualCommissions) {
    console.log(`! ${r.date} ${r.category} ${r.currency} ${fmt(r.amount)} · ${r.agent ?? "-"} · ${r.description ?? ""}`);
  }
}

console.log(`\n${updates.length} movimiento(s) a migrar, ${review.length} para revisar.`);

if (APPLY && updates.length) {
  await client.query("BEGIN");
  for (const u of updates) {
    await client.query(
      `UPDATE profitos.jp_account_entries SET fee_percentage = $2, agent_percentage = $3, updated_at = now() WHERE id = $1`,
      [u.id, u.fee, u.agent]
    );
  }
  await client.query("COMMIT");
  console.log("Aplicado.");
} else if (!APPLY) {
  console.log("Dry-run: no se cambió nada (usar --apply).");
}

await client.end();
