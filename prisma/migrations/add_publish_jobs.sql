-- Cola de jobs de publicación por portal (ZonaProp/ArgenProp vía worker).
CREATE TABLE IF NOT EXISTS jp_publish_jobs (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL,
  portal       TEXT NOT NULL,
  action       TEXT NOT NULL DEFAULT 'publish',
  status       TEXT NOT NULL DEFAULT 'pending',
  error        TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS jp_publish_jobs_status_portal_idx ON jp_publish_jobs (status, portal);
