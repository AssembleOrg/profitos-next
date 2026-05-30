-- Estados de cuenta: caja/finanzas global de la inmobiliaria.
-- Libro único de ingresos y egresos, con categorías personalizables (ABM),
-- moneda ARS/USD por separado y atribución opcional por agente.
--
-- Las comisiones de alquiler NO se guardan acá: se calculan al leer desde
-- jp_rental_payment_transactions (entradas "virtuales"), por lo que siempre
-- quedan sincronizadas con los pagos reales. La categoría de sistema
-- 'sys_rental_commission' existe igual para que aparezca en los filtros.

SET search_path TO profitos;

-- ── Categorías de ingreso/egreso ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "jp_account_categories" (
  "id"          text PRIMARY KEY,
  "name"        text NOT NULL,
  -- 'income' | 'expense'
  "kind"        text NOT NULL,
  "color"       text,
  "is_system"   boolean NOT NULL DEFAULT false,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "archived_at" timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "jp_account_categories_name_kind_key"
  ON "jp_account_categories" (lower("name"), "kind");

CREATE INDEX IF NOT EXISTS "jp_account_categories_kind_idx"
  ON "jp_account_categories" ("kind");

-- ── Movimientos (ingresos / egresos manuales) ──────────────────────
CREATE TABLE IF NOT EXISTS "jp_account_entries" (
  "id"                 text PRIMARY KEY,
  -- 'income' | 'expense' (debe coincidir con el kind de la categoría)
  "type"               text NOT NULL,
  "category_id"        text REFERENCES "jp_account_categories"("id") ON DELETE SET NULL,
  "amount"             double precision NOT NULL,
  -- 'ARS' | 'USD'
  "currency"           text NOT NULL DEFAULT 'ARS',
  -- fecha contable del movimiento (para filtros y agrupado mensual)
  "date"               date NOT NULL,
  "description"        text,
  -- agente/vendedor opcional al que se atribuye el movimiento
  "agent_user_id"      text REFERENCES "jp_users"("id") ON DELETE SET NULL,
  -- propiedad opcional vinculada (ej: comisión de venta)
  "property_id"        text REFERENCES "jp_propiedades"("id") ON DELETE SET NULL,
  -- comprobantes [{ path, name, size, mime }]
  "attachments"        jsonb,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_account_entries_date_idx"
  ON "jp_account_entries" ("date");

CREATE INDEX IF NOT EXISTS "jp_account_entries_type_idx"
  ON "jp_account_entries" ("type");

CREATE INDEX IF NOT EXISTS "jp_account_entries_category_id_idx"
  ON "jp_account_entries" ("category_id");

CREATE INDEX IF NOT EXISTS "jp_account_entries_currency_idx"
  ON "jp_account_entries" ("currency");

CREATE INDEX IF NOT EXISTS "jp_account_entries_agent_user_id_idx"
  ON "jp_account_entries" ("agent_user_id");

-- ── Categorías precargadas ─────────────────────────────────────────
-- 'sys_rental_commission' es de sistema: la usan las comisiones de alquiler
-- virtuales. El resto son semillas editables/borrables por el usuario.
INSERT INTO "jp_account_categories" ("id", "name", "kind", "color", "is_system", "sort_order")
VALUES
  ('sys_rental_commission', 'Comisión de alquiler', 'income', '#10b981', true, 0),
  ('seed_sale_commission',  'Comisión de venta',    'income', '#22c55e', false, 1),
  ('seed_appraisal',        'Tasación',             'income', '#06b6d4', false, 2),
  ('seed_other_income',     'Otros ingresos',       'income', '#84cc16', false, 3),
  ('seed_salaries',         'Sueldos',              'expense', '#ef4444', false, 0),
  ('seed_agent_commission', 'Comisiones a agentes', 'expense', '#f97316', false, 1),
  ('seed_office_rent',      'Alquiler oficina',     'expense', '#a855f7', false, 2),
  ('seed_services',         'Servicios',            'expense', '#eab308', false, 3),
  ('seed_marketing',        'Marketing',            'expense', '#ec4899', false, 4),
  ('seed_taxes',            'Impuestos',            'expense', '#64748b', false, 5),
  ('seed_other_expense',    'Otros gastos',         'expense', '#94a3b8', false, 6)
ON CONFLICT ("id") DO NOTHING;
