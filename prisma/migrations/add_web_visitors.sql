-- Web pública: visitantes con Google y registro de actividad. Aditivo e idempotente.
CREATE TABLE IF NOT EXISTS profitos.jp_web_visitors (
  id                   text PRIMARY KEY,
  google_sub           text NOT NULL UNIQUE,
  email                text NOT NULL,
  name                 text,
  picture_url          text,
  phone                text,
  phone_ask_count      integer NOT NULL DEFAULT 0,
  phone_last_asked_at  timestamp(3),
  marketing_consent    boolean NOT NULL DEFAULT false,
  terms_accepted_at    timestamp(3),
  login_count          integer NOT NULL DEFAULT 0,
  first_login_at       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_internal          boolean NOT NULL DEFAULT false,
  favorites            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at           timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS jp_web_visitors_email_idx ON profitos.jp_web_visitors (email);

CREATE TABLE IF NOT EXISTS profitos.jp_web_events (
  id             text PRIMARY KEY,
  client_id      text NOT NULL UNIQUE,
  anon_id        text NOT NULL,
  session_id     text NOT NULL,
  visitor_id     text REFERENCES profitos.jp_web_visitors (id) ON DELETE SET NULL,
  type           text NOT NULL,
  path           text,
  property_key   text,
  address        text,
  operation      text,
  property_type  text,
  zone           text,
  price          double precision,
  currency       text,
  query          text,
  filters        jsonb,
  results_count  integer,
  duration_ms    integer,
  scroll_depth   integer,
  label          text,
  device         text,
  browser        text,
  channel        text,
  referrer_host  text,
  utm_source     text,
  utm_campaign   text,
  is_bot         boolean NOT NULL DEFAULT false,
  created_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS jp_web_events_created_at_type_idx ON profitos.jp_web_events (created_at, type);
CREATE INDEX IF NOT EXISTS jp_web_events_anon_id_created_at_idx ON profitos.jp_web_events (anon_id, created_at);
CREATE INDEX IF NOT EXISTS jp_web_events_visitor_id_created_at_idx ON profitos.jp_web_events (visitor_id, created_at);
CREATE INDEX IF NOT EXISTS jp_web_events_property_key_created_at_idx ON profitos.jp_web_events (property_key, created_at);

-- Sin políticas: la clave pública de Supabase no puede leer estos datos. Prisma entra como dueño.
ALTER TABLE profitos.jp_web_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitos.jp_web_events ENABLE ROW LEVEL SECURITY;
