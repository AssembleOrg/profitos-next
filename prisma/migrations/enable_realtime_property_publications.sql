-- Habilita realtime en jp_property_publications para notificar cambios de estado
-- de publicaciones (ej: aviso pausado/cerrado) en vivo en la campana.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='profitos' AND tablename='jp_property_publications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profitos.jp_property_publications;
  END IF;
END $$;
