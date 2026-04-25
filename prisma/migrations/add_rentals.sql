-- Sistema de alquileres temporales: inquilinos, contratos, vencimientos, pagos.

SET search_path TO profitos;

CREATE TABLE IF NOT EXISTS "jp_tenants" (
  "id" text PRIMARY KEY,
  "full_name" text NOT NULL,
  "id_type" text NOT NULL,
  "id_number" text NOT NULL,
  "phone" text,
  "email" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_tenants_full_name_idx"
  ON "jp_tenants" ("full_name");

CREATE TABLE IF NOT EXISTS "jp_rental_additionals" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "default_amount" double precision,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "jp_rental_contracts" (
  "id" text PRIMARY KEY,
  "property_id" text NOT NULL REFERENCES "jp_propiedades"("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL REFERENCES "jp_tenants"("id") ON DELETE CASCADE,
  "title" text,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "frequency" text NOT NULL,
  "base_amount" double precision NOT NULL,
  "currency" text NOT NULL DEFAULT 'ARS',
  "first_due_date" date NOT NULL,
  "grace_period_days" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_rental_contracts_property_id_idx"
  ON "jp_rental_contracts" ("property_id");

CREATE INDEX IF NOT EXISTS "jp_rental_contracts_tenant_id_idx"
  ON "jp_rental_contracts" ("tenant_id");

CREATE INDEX IF NOT EXISTS "jp_rental_contracts_period_idx"
  ON "jp_rental_contracts" ("start_date", "end_date");

CREATE TABLE IF NOT EXISTS "jp_rental_contract_additionals" (
  "id" text PRIMARY KEY,
  "contract_id" text NOT NULL REFERENCES "jp_rental_contracts"("id") ON DELETE CASCADE,
  "additional_id" text NOT NULL REFERENCES "jp_rental_additionals"("id") ON DELETE CASCADE,
  "amount" double precision NOT NULL,
  "position" integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "jp_rental_contract_additionals_contract_id_idx"
  ON "jp_rental_contract_additionals" ("contract_id");

CREATE TABLE IF NOT EXISTS "jp_rental_due_dates" (
  "id" text PRIMARY KEY,
  "contract_id" text NOT NULL REFERENCES "jp_rental_contracts"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "due_date" date NOT NULL,
  "expected_amount" double precision NOT NULL,
  "status" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_rental_due_dates_contract_id_idx"
  ON "jp_rental_due_dates" ("contract_id");

CREATE INDEX IF NOT EXISTS "jp_rental_due_dates_due_date_idx"
  ON "jp_rental_due_dates" ("due_date");

CREATE TABLE IF NOT EXISTS "jp_rental_due_date_additionals" (
  "id" text PRIMARY KEY,
  "due_date_id" text NOT NULL REFERENCES "jp_rental_due_dates"("id") ON DELETE CASCADE,
  "contract_additional_id" text NOT NULL REFERENCES "jp_rental_contract_additionals"("id") ON DELETE CASCADE,
  "included" boolean NOT NULL DEFAULT true,
  "amount_override" double precision,
  CONSTRAINT "jp_rental_due_date_additionals_unique"
    UNIQUE ("due_date_id", "contract_additional_id")
);

CREATE INDEX IF NOT EXISTS "jp_rental_due_date_additionals_due_date_id_idx"
  ON "jp_rental_due_date_additionals" ("due_date_id");

CREATE TABLE IF NOT EXISTS "jp_rental_payment_transactions" (
  "id" text PRIMARY KEY,
  "due_date_id" text NOT NULL REFERENCES "jp_rental_due_dates"("id") ON DELETE CASCADE,
  "amount_paid" double precision NOT NULL,
  "commission_amount" double precision NOT NULL DEFAULT 0,
  "owner_amount" double precision NOT NULL DEFAULT 0,
  "method" text,
  "paid_at" timestamptz NOT NULL,
  "is_full" boolean NOT NULL DEFAULT true,
  "notes" text,
  "attachments" jsonb,
  "receipt_number" integer,
  "receipt_path" text,
  "receipt_issued_at" timestamptz,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_rental_payment_transactions_due_date_id_idx"
  ON "jp_rental_payment_transactions" ("due_date_id");

CREATE INDEX IF NOT EXISTS "jp_rental_payment_transactions_paid_at_idx"
  ON "jp_rental_payment_transactions" ("paid_at");

CREATE TABLE IF NOT EXISTS "jp_rental_due_date_actions" (
  "id" text PRIMARY KEY,
  "due_date_id" text NOT NULL REFERENCES "jp_rental_due_dates"("id") ON DELETE CASCADE,
  "type" text NOT NULL DEFAULT 'nota',
  "from_status" text,
  "to_status" text,
  "description" text,
  "attachments" jsonb,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_rental_due_date_actions_due_date_id_idx"
  ON "jp_rental_due_date_actions" ("due_date_id");

-- Secuencia para numeración de comprobantes (recibos).
-- Se consume con SELECT nextval('jp_rental_receipt_seq') al emitir un PDF.
CREATE SEQUENCE IF NOT EXISTS "jp_rental_receipt_seq" START 1;
