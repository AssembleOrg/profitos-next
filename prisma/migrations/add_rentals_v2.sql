-- Alquileres v2: alquiler tradicional, propietarios, honorarios, aumentos,
-- talonarios de recibos (inquilino / propietario), comprobantes de servicios
-- y portal de inquilinos.
--
-- 100% aditivo e idempotente: no borra ni reescribe datos existentes.
-- Los contratos con frecuencia distinta de "mensual" quedan marcados como
-- "temporal" (se siguen viendo, pero la UI nueva solo crea tradicionales).
--
-- Aplicar:
--   pnpm prisma db execute --file prisma/migrations/add_rentals_v2.sql --config prisma/prisma.config.ts

SET search_path TO profitos;

-- ─────────────────────────────────────────────────────────────────────
-- Propietarios (locadores)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "jp_owners" (
  "id"          text PRIMARY KEY,
  "full_name"   text NOT NULL,
  "id_type"     text NOT NULL DEFAULT 'dni',
  "id_number"   text,
  "phone"       text,
  "email"       text,
  "notes"       text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jp_owners_full_name_idx" ON "jp_owners" ("full_name");

-- ─────────────────────────────────────────────────────────────────────
-- Contratos: condiciones del legajo
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE "jp_rental_contracts"
  ADD COLUMN IF NOT EXISTS "kind"                    text NOT NULL DEFAULT 'tradicional',
  ADD COLUMN IF NOT EXISTS "owner_id"                text REFERENCES "jp_owners" ("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "unit"                    text,
  ADD COLUMN IF NOT EXISTS "fee_percent"             double precision NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "due_day"                 integer,
  ADD COLUMN IF NOT EXISTS "adjustment_every_months" integer,
  ADD COLUMN IF NOT EXISTS "adjustment_index"        text,
  ADD COLUMN IF NOT EXISTS "adjustment_next_date"    date,
  ADD COLUMN IF NOT EXISTS "tenant_services"         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "guarantee_type"          text,
  ADD COLUMN IF NOT EXISTS "guarantee_detail"        text,
  ADD COLUMN IF NOT EXISTS "deposit_amount"          double precision,
  ADD COLUMN IF NOT EXISTS "advance_amount"          double precision,
  ADD COLUMN IF NOT EXISTS "advance_detail"          text;

UPDATE "jp_rental_contracts" SET "kind" = 'temporal'
WHERE "frequency" <> 'mensual' AND "kind" = 'tradicional';

CREATE INDEX IF NOT EXISTS "jp_rental_contracts_owner_id_idx" ON "jp_rental_contracts" ("owner_id");
CREATE INDEX IF NOT EXISTS "jp_rental_contracts_adjustment_next_date_idx" ON "jp_rental_contracts" ("adjustment_next_date");

-- Monto de alquiler propio de cada cuota (null = usar base_amount del contrato).
-- Permite aumentar desde un mes sin tocar los anteriores.
ALTER TABLE "jp_rental_due_dates"
  ADD COLUMN IF NOT EXISTS "rent_amount" double precision;

-- ─────────────────────────────────────────────────────────────────────
-- Pagos: % de honorarios aplicado y desglose congelado (para recibos)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE "jp_rental_payment_transactions"
  ADD COLUMN IF NOT EXISTS "fee_percent" double precision,
  ADD COLUMN IF NOT EXISTS "breakdown"   jsonb;

-- ─────────────────────────────────────────────────────────────────────
-- Historial de aumentos
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "jp_rental_adjustments" (
  "id"                  text PRIMARY KEY,
  "contract_id"         text NOT NULL REFERENCES "jp_rental_contracts" ("id") ON DELETE CASCADE,
  "effective_date"      date NOT NULL,
  "previous_amount"     double precision NOT NULL,
  "new_amount"          double precision NOT NULL,
  "index_label"         text,
  "notes"               text,
  "created_by_user_id"  text NOT NULL REFERENCES "jp_users" ("id") ON DELETE CASCADE,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jp_rental_adjustments_contract_id_idx" ON "jp_rental_adjustments" ("contract_id");

-- ─────────────────────────────────────────────────────────────────────
-- Talonarios y recibos numerados
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "jp_receipt_books" (
  "id"             text PRIMARY KEY,
  -- inquilino = "Recibo por cuenta de terceros" · propietario = "Recibo"
  "kind"           text NOT NULL UNIQUE,
  "label"          text NOT NULL,
  "point_of_sale"  integer NOT NULL DEFAULT 1,
  "next_number"    integer NOT NULL DEFAULT 1,
  -- false hasta que alguien confirma el número inicial del talonario
  "configured"     boolean NOT NULL DEFAULT false,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "jp_receipt_books" ("id", "kind", "label")
VALUES
  ('book_inquilino', 'inquilino', 'Recibo por cuenta de terceros'),
  ('book_propietario', 'propietario', 'Recibo al propietario')
ON CONFLICT ("kind") DO NOTHING;

CREATE TABLE IF NOT EXISTS "jp_rental_receipts" (
  "id"                  text PRIMARY KEY,
  "book_kind"           text NOT NULL,
  "point_of_sale"       integer NOT NULL,
  "number"              integer NOT NULL,
  -- emitido | anulado
  "status"              text NOT NULL DEFAULT 'emitido',
  "transaction_id"      text REFERENCES "jp_rental_payment_transactions" ("id") ON DELETE SET NULL,
  "contract_id"         text REFERENCES "jp_rental_contracts" ("id") ON DELETE SET NULL,
  "amount"              double precision,
  "pdf_path"            text,
  "issued_at"           timestamptz,
  "void_reason"         text,
  "voided_at"           timestamptz,
  "voided_by_user_id"   text REFERENCES "jp_users" ("id") ON DELETE SET NULL,
  "created_by_user_id"  text REFERENCES "jp_users" ("id") ON DELETE SET NULL,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("book_kind", "point_of_sale", "number")
);
CREATE INDEX IF NOT EXISTS "jp_rental_receipts_transaction_id_idx" ON "jp_rental_receipts" ("transaction_id");
CREATE INDEX IF NOT EXISTS "jp_rental_receipts_contract_id_idx" ON "jp_rental_receipts" ("contract_id");
CREATE INDEX IF NOT EXISTS "jp_rental_receipts_issued_at_idx" ON "jp_rental_receipts" ("issued_at");

-- ─────────────────────────────────────────────────────────────────────
-- Comprobantes de servicios (los sube el inquilino o el staff)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "jp_rental_service_proofs" (
  "id"                   text PRIMARY KEY,
  "contract_id"          text NOT NULL REFERENCES "jp_rental_contracts" ("id") ON DELETE CASCADE,
  "due_date_id"          text REFERENCES "jp_rental_due_dates" ("id") ON DELETE SET NULL,
  "service"              text NOT NULL,
  -- YYYY-MM
  "period"               text NOT NULL,
  "amount"               double precision,
  "attachments"          jsonb NOT NULL DEFAULT '[]'::jsonb,
  "notes"                text,
  -- pendiente | aprobado | rechazado
  "status"               text NOT NULL DEFAULT 'pendiente',
  "review_note"          text,
  "reviewed_by_user_id"  text REFERENCES "jp_users" ("id") ON DELETE SET NULL,
  "reviewed_at"          timestamptz,
  "uploaded_by_tenant"   boolean NOT NULL DEFAULT true,
  "created_at"           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jp_rental_service_proofs_contract_id_idx" ON "jp_rental_service_proofs" ("contract_id");
CREATE INDEX IF NOT EXISTS "jp_rental_service_proofs_status_idx" ON "jp_rental_service_proofs" ("status");

-- ─────────────────────────────────────────────────────────────────────
-- Portal de inquilinos: cuenta Supabase (email + contraseña) vinculada
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE "jp_tenants"
  ADD COLUMN IF NOT EXISTS "auth_user_id"         text UNIQUE,
  ADD COLUMN IF NOT EXISTS "portal_enabled"       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "portal_invited_at"    timestamptz,
  ADD COLUMN IF NOT EXISTS "portal_last_login_at" timestamptz;

-- ─────────────────────────────────────────────────────────────────────
-- Seguridad: con inquilinos logueados, "authenticated" ya no equivale a
-- staff. Toda operación directa sobre Storage exige ser usuario del staff
-- (fila en jp_users). Política RESTRICTIVE: se combina con AND sobre las
-- políticas existentes de cada bucket, sin reescribirlas. El portal accede
-- a sus archivos desde el server con service role.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "profitos"."is_staff"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = profitos
AS $$
  SELECT EXISTS (SELECT 1 FROM "profitos"."jp_users" WHERE "id" = auth.uid()::text);
$$;

REVOKE ALL ON FUNCTION "profitos"."is_staff"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "profitos"."is_staff"() TO authenticated;

DROP POLICY IF EXISTS "storage_staff_only" ON storage.objects;
CREATE POLICY "storage_staff_only"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ("profitos"."is_staff"())
  WITH CHECK ("profitos"."is_staff"());
