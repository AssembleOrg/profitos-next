-- Panel de Difusión: avisos de la cuenta en cada portal con plan, calidad y
-- problemas informados por el portal (lo llena el worker). Idempotente.
CREATE TABLE IF NOT EXISTS profitos.jp_portal_listings (
  id                 text PRIMARY KEY,
  portal             text NOT NULL,
  external_id        text NOT NULL,
  property_id        text,
  code               text,
  title              text,
  address            text,
  url                text,
  picture_url        text,
  status             text NOT NULL,
  published          boolean NOT NULL DEFAULT false,
  plan               text,
  quality            integer,
  issues             jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at      timestamp(3) NOT NULL DEFAULT now(),
  last_seen_at       timestamp(3) NOT NULL DEFAULT now(),
  issues_changed_at  timestamp(3),
  gone               boolean NOT NULL DEFAULT false,
  updated_at         timestamp(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS jp_portal_listings_portal_external_id_key ON profitos.jp_portal_listings (portal, external_id);
CREATE INDEX IF NOT EXISTS jp_portal_listings_portal_published_idx ON profitos.jp_portal_listings (portal, published);
CREATE INDEX IF NOT EXISTS jp_portal_listings_property_id_idx ON profitos.jp_portal_listings (property_id);

CREATE TABLE IF NOT EXISTS profitos.jp_portal_diffusion (
  portal     text PRIMARY KEY,
  synced_at  timestamp(3) NOT NULL DEFAULT now(),
  ok         boolean NOT NULL DEFAULT true,
  error      text,
  summary    jsonb
);
