-- Estado de gestión de contactos de la central de mensajes (tomado/espera/descartado).
CREATE TABLE IF NOT EXISTS profitos.jp_contact_cases (
  id TEXT PRIMARY KEY,
  portal TEXT NOT NULL,
  status TEXT NOT NULL,
  taken_by_user_id TEXT REFERENCES profitos.jp_users(id) ON DELETE SET NULL,
  client_id TEXT,
  follow_up_id TEXT,
  waiting_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS jp_contact_cases_status_idx ON profitos.jp_contact_cases (status);
