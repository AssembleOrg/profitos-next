-- Vínculo directo seguimiento → cliente (antes solo indirecto vía jp_contact_cases).
ALTER TABLE profitos.jp_property_followups
  ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES profitos.jp_clientes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jp_property_followups_client_id_idx
  ON profitos.jp_property_followups (client_id);
-- Backfill desde consultas ya tomadas.
UPDATE profitos.jp_property_followups f SET client_id = c.client_id
  FROM profitos.jp_contact_cases c
  WHERE c.follow_up_id = f.id AND c.client_id IS NOT NULL AND f.client_id IS NULL;
