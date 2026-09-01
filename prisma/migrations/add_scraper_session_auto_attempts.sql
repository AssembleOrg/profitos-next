-- Intentos de re-login automático consumidos por el worker desde que la sesión
-- se cayó. Se resetea a 0 cuando el login (auto o manual) queda OK.
ALTER TABLE profitos.jp_scraper_sessions
  ADD COLUMN IF NOT EXISTS auto_attempts integer NOT NULL DEFAULT 0;
