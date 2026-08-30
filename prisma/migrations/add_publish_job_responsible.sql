-- Responsable elegido para el aviso (ZonaProp userId) en cada job de publicación.
ALTER TABLE profitos.jp_publish_jobs ADD COLUMN IF NOT EXISTS responsible_user_id text;
