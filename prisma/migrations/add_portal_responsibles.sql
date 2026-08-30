-- Responsables de publicación por portal (lo refresca el worker al publicar).
CREATE TABLE IF NOT EXISTS profitos.jp_portal_responsibles (
  portal      text PRIMARY KEY,
  users       jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed inicial ZonaProp (de la captura STEP_PLAN_SELECTION 2026-08).
INSERT INTO profitos.jp_portal_responsibles (portal, users)
VALUES ('zonaprop', '[
  {"userId":17113813,"name":"Juliana","lastName":"Profitos","email":"profitospropiedades@gmail.com"},
  {"userId":50202762,"name":"Octavio","lastName":"Zarini","email":"Octaviozarini@gmail.com"},
  {"userId":52170578,"name":"Sebastian","lastName":"Galazzi","email":"sebastian.galazzi@gmail.com"},
  {"userId":52170615,"name":"Valentina","lastName":"Chaves","email":"valen.jpropiedades@gmail.com"},
  {"userId":52351216,"name":"Agustina","lastName":"Da Silva","email":"agustina.jprofitospropiedades@gmail.com"},
  {"userId":52351251,"name":"Juliana","lastName":"Profitos","email":"jp.jprofitospropiedades@gmail.com"},
  {"userId":52821540,"name":"Julieta","lastName":"De Titta","email":"admalquileres50@gmail.com"}
]'::jsonb)
ON CONFLICT (portal) DO NOTHING;
