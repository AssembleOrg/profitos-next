-- =============================================================================
-- RLS Policies for all jp_* tables
-- =============================================================================
-- Supabase uses auth.uid() to get the authenticated user's ID.
-- These policies ensure that:
--   - Users can only read/write their OWN rows (matched by user_id)
--   - The whitelist table is read-only for authenticated users
--   - service_role and postgres bypass RLS automatically
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. jp_whitelist — read-only for authenticated, no public access
-- ---------------------------------------------------------------------------
ALTER TABLE "jp_whitelist" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whitelist_select_authenticated" ON "jp_whitelist";
CREATE POLICY "whitelist_select_authenticated"
  ON "jp_whitelist"
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. jp_users — users can only read/update their own row
-- ---------------------------------------------------------------------------
ALTER TABLE "jp_users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON "jp_users";
CREATE POLICY "users_select_own"
  ON "jp_users"
  FOR SELECT
  TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_insert_own" ON "jp_users";
CREATE POLICY "users_insert_own"
  ON "jp_users"
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_update_own" ON "jp_users";
CREATE POLICY "users_update_own"
  ON "jp_users"
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 3. jp_propiedades — full CRUD scoped to user_id
-- ---------------------------------------------------------------------------
ALTER TABLE "jp_propiedades" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propiedades_select_own" ON "jp_propiedades";
CREATE POLICY "propiedades_select_own"
  ON "jp_propiedades"
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "propiedades_insert_own" ON "jp_propiedades";
CREATE POLICY "propiedades_insert_own"
  ON "jp_propiedades"
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "propiedades_update_own" ON "jp_propiedades";
CREATE POLICY "propiedades_update_own"
  ON "jp_propiedades"
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "propiedades_delete_own" ON "jp_propiedades";
CREATE POLICY "propiedades_delete_own"
  ON "jp_propiedades"
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 4. jp_clientes — full CRUD scoped to user_id
-- ---------------------------------------------------------------------------
ALTER TABLE "jp_clientes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select_own" ON "jp_clientes";
CREATE POLICY "clientes_select_own"
  ON "jp_clientes"
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "clientes_insert_own" ON "jp_clientes";
CREATE POLICY "clientes_insert_own"
  ON "jp_clientes"
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "clientes_update_own" ON "jp_clientes";
CREATE POLICY "clientes_update_own"
  ON "jp_clientes"
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "clientes_delete_own" ON "jp_clientes";
CREATE POLICY "clientes_delete_own"
  ON "jp_clientes"
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 5. jp_visitas — full CRUD scoped to user_id
-- ---------------------------------------------------------------------------
ALTER TABLE "jp_visitas" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitas_select_own" ON "jp_visitas";
CREATE POLICY "visitas_select_own"
  ON "jp_visitas"
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "visitas_insert_own" ON "jp_visitas";
CREATE POLICY "visitas_insert_own"
  ON "jp_visitas"
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "visitas_update_own" ON "jp_visitas";
CREATE POLICY "visitas_update_own"
  ON "jp_visitas"
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "visitas_delete_own" ON "jp_visitas";
CREATE POLICY "visitas_delete_own"
  ON "jp_visitas"
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);
