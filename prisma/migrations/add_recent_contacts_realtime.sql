-- Realtime + access policies for jp_ultimos_contactos
-- Run this once in Supabase SQL Editor (or via your migration pipeline)

-- 1) Ensure table is part of realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'profitos'
      AND tablename = 'jp_ultimos_contactos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE "profitos"."jp_ultimos_contactos"';
  END IF;
END $$;

-- 2) Grants for authenticated users
GRANT USAGE ON SCHEMA "profitos" TO authenticated;
GRANT SELECT ON TABLE "profitos"."jp_ultimos_contactos" TO authenticated;

-- 3) RLS: admins see all, non-admin sees only assigned contacts by agent_email
ALTER TABLE "profitos"."jp_ultimos_contactos" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recent_contacts_select_admin_or_assigned" ON "profitos"."jp_ultimos_contactos";
CREATE POLICY "recent_contacts_select_admin_or_assigned"
  ON "profitos"."jp_ultimos_contactos"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM "profitos"."jp_users" u
      WHERE u.id = auth.uid()::text
        AND lower(coalesce(u.role, '')) = 'admin'
    )
    OR lower(coalesce(agent_email, '')) = lower(
      coalesce(
        (
          SELECT u2.email
          FROM "profitos"."jp_users" u2
          WHERE u2.id = auth.uid()::text
          LIMIT 1
        ),
        ''
      )
    )
  );
