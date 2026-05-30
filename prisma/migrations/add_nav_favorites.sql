-- Favoritos del menú por usuario (sincronizados entre desktop y mobile).
-- Guarda un array de hrefs, ej: ["/alquileres", "/tasaciones"].

SET search_path TO profitos;

ALTER TABLE "jp_users" ADD COLUMN IF NOT EXISTS "nav_favorites" jsonb;
