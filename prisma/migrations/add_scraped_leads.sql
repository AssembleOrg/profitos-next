-- Scraper de leads de portales (ZonaProp / ArgenProp).
-- Guarda cada consulta traída de la API interna de cada portal, con dedup
-- por (portal, section, external_id). Y la sesión de Playwright por portal.

CREATE TABLE IF NOT EXISTS profitos.jp_scraped_leads (
  id               text PRIMARY KEY,
  portal           text NOT NULL,
  section          text NOT NULL,
  external_id      text NOT NULL,
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  message_text     text,
  message_at       timestamptz,
  property_ref     text,
  property_title   text,
  property_address text,
  property_url     text,
  price            text,
  map_polygon      jsonb,
  raw              jsonb,
  scraped_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jp_scraped_leads_portal_section_external_uq
    UNIQUE (portal, section, external_id)
);

CREATE INDEX IF NOT EXISTS jp_scraped_leads_portal_section_scraped_idx
  ON profitos.jp_scraped_leads (portal, section, scraped_at);

CREATE TABLE IF NOT EXISTS profitos.jp_scraper_sessions (
  id            text PRIMARY KEY,
  portal        text NOT NULL UNIQUE,
  storage_state jsonb NOT NULL,
  valid         boolean NOT NULL DEFAULT true,
  last_ok_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
