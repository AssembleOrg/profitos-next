-- Movimientos: % informativo dado al agente (egresos) + flag "compartido".
-- Ambos son informativos; no participan de cálculos por ahora.
ALTER TABLE profitos.jp_account_entries
  ADD COLUMN IF NOT EXISTS agent_percentage double precision,
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS jp_account_entries_is_shared_idx
  ON profitos.jp_account_entries (is_shared);
