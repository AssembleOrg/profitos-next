-- Estados de cuenta: áreas (Administración / Ventas / General) por categoría
-- + % de honorarios de la inmobiliaria separado de la comisión del agente.
-- Idempotente.
ALTER TABLE profitos.jp_account_categories
  ADD COLUMN IF NOT EXISTS area text;

ALTER TABLE profitos.jp_account_entries
  ADD COLUMN IF NOT EXISTS fee_percentage double precision;

-- Áreas de las categorías existentes (solo las que todavía no tienen).
UPDATE profitos.jp_account_categories SET area = 'administracion'
WHERE area IS NULL AND (id = 'sys_rental_commission' OR name ILIKE '%alquiler%' OR name ILIKE '%administraci%')
  AND id <> 'seed_office_rent';

UPDATE profitos.jp_account_categories SET area = 'ventas'
WHERE area IS NULL AND (id IN ('seed_sale_commission', 'seed_agent_commission') OR name ILIKE '%venta%');
