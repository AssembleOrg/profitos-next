-- Perfil del equipo (foto propia + teléfonos) y sesiones por dispositivo. Aditivo e idempotente.
ALTER TABLE profitos.jp_users ADD COLUMN IF NOT EXISTS avatar_custom boolean NOT NULL DEFAULT false;
ALTER TABLE profitos.jp_users ADD COLUMN IF NOT EXISTS contact_phones jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profitos.jp_users ADD COLUMN IF NOT EXISTS sessions_revoked_at timestamp(3);

-- Una fila por sesión de Supabase (id = session_id del JWT). Guarda el
-- dispositivo, la IP y la ubicación tomada una sola vez al entrar.
CREATE TABLE IF NOT EXISTS profitos.jp_user_sessions (
  id               text PRIMARY KEY,
  user_id          text NOT NULL REFERENCES profitos.jp_users (id) ON DELETE CASCADE,
  user_agent       text,
  device           text,
  ip               text,
  locality         text,
  area             text,
  region           text,
  country          text,
  latitude         double precision,
  longitude        double precision,
  accuracy         double precision,
  location_source  text,
  created_at       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at       timestamp(3)
);
CREATE INDEX IF NOT EXISTS jp_user_sessions_user_id_created_at_idx ON profitos.jp_user_sessions (user_id, created_at);

-- Sin políticas: la clave pública de Supabase no puede leer estos datos. Prisma entra como dueño.
ALTER TABLE profitos.jp_user_sessions ENABLE ROW LEVEL SECURITY;
