-- El "valor al agente" (informativo, solo egresos) ahora puede ser un
-- porcentaje o un monto fijo. agent_percentage guarda el número; este campo
-- indica cómo interpretarlo. Las filas existentes eran porcentajes.
ALTER TABLE profitos.jp_account_entries
  ADD COLUMN IF NOT EXISTS agent_share_type text NOT NULL DEFAULT 'percent';
