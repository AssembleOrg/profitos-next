-- Responsables internos por propiedad (ruteo de notificaciones de consultas).
CREATE TABLE IF NOT EXISTS profitos.jp_property_responsibles (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES profitos.jp_propiedades(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profitos.jp_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT jp_property_responsibles_property_user_key UNIQUE (property_id, user_id)
);
CREATE INDEX IF NOT EXISTS jp_property_responsibles_user_idx ON profitos.jp_property_responsibles (user_id);
