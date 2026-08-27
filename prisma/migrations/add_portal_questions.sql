-- Preguntas de publicaciones en portales (leads), pobladas por webhook.
CREATE TABLE IF NOT EXISTS jp_portal_questions (
  id           TEXT PRIMARY KEY,
  portal       TEXT NOT NULL DEFAULT 'mercadolibre',
  external_id  TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  property_id  TEXT,
  text         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'UNANSWERED',
  answer_text  TEXT,
  from_user_id TEXT,
  asked_at     TIMESTAMP(3),
  answered_at  TIMESTAMP(3),
  raw_payload  JSONB,
  created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS jp_portal_questions_portal_external_id_key
  ON jp_portal_questions (portal, external_id);
CREATE INDEX IF NOT EXISTS jp_portal_questions_property_id_idx
  ON jp_portal_questions (property_id);
CREATE INDEX IF NOT EXISTS jp_portal_questions_item_id_idx
  ON jp_portal_questions (item_id);
