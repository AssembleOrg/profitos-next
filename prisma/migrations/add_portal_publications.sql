-- Publicaciones de inmuebles en portales (MercadoLibre, ZonaProp, Adinco...).
-- jp_portal_tokens: OAuth por portal (cuenta única de la inmobiliaria).
-- jp_property_publications: estado de cada propiedad en cada portal.

CREATE TABLE IF NOT EXISTS profitos.jp_portal_tokens (
  id             text PRIMARY KEY,
  portal         text NOT NULL UNIQUE,          -- 'mercadolibre' | 'zonaprop' | 'adinco'
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,                   -- vencimiento del access_token
  external_user  text,                          -- user_id del portal (ML seller id)
  nickname       text,
  scope          text,
  connected_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profitos.jp_property_publications (
  id             text PRIMARY KEY,
  property_id    text NOT NULL REFERENCES profitos.jp_propiedades(id) ON DELETE CASCADE,
  portal         text NOT NULL,                 -- 'mercadolibre' | 'zonaprop' | 'adinco'
  external_id    text,                          -- item id del portal (ML: MLA123...)
  status         text NOT NULL DEFAULT 'draft', -- draft|publishing|active|paused|closed|error
  permalink      text,
  category_id    text,
  listing_type_id text,
  last_payload   jsonb,
  last_error     text,
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jp_property_publications_property_portal_uq
    UNIQUE (property_id, portal)
);

CREATE INDEX IF NOT EXISTS jp_property_publications_portal_status_idx
  ON profitos.jp_property_publications (portal, status);
