-- Habilita realtime en jp_scraped_leads y jp_portal_questions para que la
-- campana avise en vivo cuando entra un contacto nuevo (lead ZP/AP o pregunta ML).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='profitos' AND tablename='jp_scraped_leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profitos.jp_scraped_leads;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='profitos' AND tablename='jp_portal_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profitos.jp_portal_questions;
  END IF;
END $$;
