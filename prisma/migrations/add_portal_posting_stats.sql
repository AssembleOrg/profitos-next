-- Informe al propietario: estadísticas de cada aviso de ZonaProp (vistas,
-- impresiones, contactos) y su serie diaria. Las llena el worker. Aditivo e idempotente.
CREATE TABLE IF NOT EXISTS profitos.jp_portal_posting_stats (
  id                   text PRIMARY KEY,
  portal               text NOT NULL,
  external_id          text NOT NULL,
  property_id          text,
  total_impressions    integer,
  total_visits         integer,
  total_leads          integer,
  period_from          date,
  period_to            date,
  impressions_30       integer,
  visits_30            integer,
  leads_30             integer,
  contacts_30          integer,
  contacts_by_channel  jsonb,
  trend                jsonb,
  segment              jsonb,
  fetched_at           timestamp(3),
  error                text,
  updated_at           timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE profitos.jp_portal_posting_stats ADD COLUMN IF NOT EXISTS weekly jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS jp_portal_posting_stats_portal_external_id_key ON profitos.jp_portal_posting_stats (portal, external_id);
CREATE INDEX IF NOT EXISTS jp_portal_posting_stats_property_id_idx ON profitos.jp_portal_posting_stats (property_id);

CREATE TABLE IF NOT EXISTS profitos.jp_portal_posting_daily (
  portal       text NOT NULL,
  external_id  text NOT NULL,
  day          date NOT NULL,
  impressions  integer NOT NULL DEFAULT 0,
  views        integer NOT NULL DEFAULT 0,
  leads        integer NOT NULL DEFAULT 0,
  updated_at   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (portal, external_id, day)
);

-- Sin políticas: la clave pública de Supabase no puede leer estos datos. Prisma entra como dueño.
ALTER TABLE profitos.jp_portal_posting_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitos.jp_portal_posting_daily ENABLE ROW LEVEL SECURITY;
