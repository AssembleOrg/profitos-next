-- Cupo de créditos de publicación por portal (lo refresca el worker).
CREATE TABLE IF NOT EXISTS profitos.jp_portal_credits (
  portal      text PRIMARY KEY,
  plans       jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw         jsonb,
  error       text,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
