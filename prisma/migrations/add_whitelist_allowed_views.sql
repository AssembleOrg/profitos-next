-- Control de acceso por vistas, por email de la whitelist.
-- allowed_views: array de hrefs permitidos, ej: ["/contactos", "/propiedades"].
--   NULL  = sin configurar (los usuarios nuevos arrancan sin acceso, opt-in).
--   Los admins ignoran esta columna (ven todo).
--
-- Grandfathering: a los emails YA existentes se les concede acceso total a las
-- vistas controlables, para no dejar afuera a nadie que ya estaba operando.
-- Solo los emails nuevos (agregados después) arrancan vacíos.

SET search_path TO profitos;

ALTER TABLE "jp_whitelist" ADD COLUMN IF NOT EXISTS "allowed_views" jsonb;

UPDATE "jp_whitelist"
SET "allowed_views" = '[
  "/contactos","/consultants","/consultants-followups","/seguimientos","/agenda",
  "/propiedades","/tasaciones","/firmas","/alquileres","/inquilinos",
  "/estados-cuenta","/objetivos","/mis-objetivos"
]'::jsonb
WHERE "allowed_views" IS NULL;
