-- Repara el schema mal aplicado: las tablas se habían creado en `public` por
-- el search_path default. El proyecto vive en `profitos`. Este script:
--   1. Crea (si no existen) las tablas en `profitos`.
--   2. Elimina las copias vacías que quedaron en `public`.
-- Es idempotente y seguro: las tablas en `public` están vacías (sin filas).

SET search_path TO profitos;

-- ── Objetivos (cards + items)  ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "jp_objective_cards" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "description" text,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status_override" text,
  "assigned_to_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_objective_cards_assigned_period_idx"
  ON "jp_objective_cards" ("assigned_to_user_id", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "jp_objective_cards_period_idx"
  ON "jp_objective_cards" ("start_date", "end_date");

CREATE TABLE IF NOT EXISTS "jp_objective_items" (
  "id" text PRIMARY KEY,
  "card_id" text NOT NULL REFERENCES "jp_objective_cards"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "position" integer NOT NULL DEFAULT 0,
  "evaluated_by_user_id" text REFERENCES "jp_users"("id") ON DELETE SET NULL,
  "evaluated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jp_objective_items_card_id_idx"
  ON "jp_objective_items" ("card_id");

-- ── Firmas (proposals + actions) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "jp_signature_proposals" (
  "id" text PRIMARY KEY,
  "property_id" text NOT NULL REFERENCES "jp_propiedades"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'propuesta_enviada',
  "title" text,
  "description" text,
  "attachments" jsonb,
  "date_process_started" timestamptz,
  "date_agreed" timestamptz,
  "date_keys_handover" timestamptz,
  "visit_informes_id" text,
  "visit_acordada_id" text,
  "visit_entrega_id" text,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jp_signature_proposals_property_id_idx"
  ON "jp_signature_proposals" ("property_id");
CREATE INDEX IF NOT EXISTS "jp_signature_proposals_status_idx"
  ON "jp_signature_proposals" ("status");
CREATE INDEX IF NOT EXISTS "jp_signature_proposals_created_by_user_id_idx"
  ON "jp_signature_proposals" ("created_by_user_id");

CREATE TABLE IF NOT EXISTS "jp_signature_proposal_actions" (
  "id" text PRIMARY KEY,
  "proposal_id" text NOT NULL REFERENCES "jp_signature_proposals"("id") ON DELETE CASCADE,
  "type" text NOT NULL DEFAULT 'nota',
  "from_status" text,
  "to_status" text,
  "date_field" text,
  "description" text,
  "attachments" jsonb,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jp_signature_proposal_actions_proposal_id_idx"
  ON "jp_signature_proposal_actions" ("proposal_id");
CREATE INDEX IF NOT EXISTS "jp_signature_proposal_actions_created_by_user_id_idx"
  ON "jp_signature_proposal_actions" ("created_by_user_id");

-- ── Alquileres (tenants + additionals + contracts + due dates + payments) ──

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

-- Sequence para numeración correlativa de comprobantes
CREATE SEQUENCE IF NOT EXISTS "jp_rental_receipt_seq" START 1;

-- ── Limpiar copias vacías que quedaron en `public` ─────────────────
-- Nota: estas tablas estaban vacías (sin filas) — verificado antes de DROP.

DROP TABLE IF EXISTS "public"."jp_rental_due_date_actions" CASCADE;
DROP TABLE IF EXISTS "public"."jp_rental_payment_transactions" CASCADE;
DROP TABLE IF EXISTS "public"."jp_rental_due_date_additionals" CASCADE;
DROP TABLE IF EXISTS "public"."jp_rental_due_dates" CASCADE;
DROP TABLE IF EXISTS "public"."jp_rental_contract_additionals" CASCADE;
DROP TABLE IF EXISTS "public"."jp_rental_contracts" CASCADE;
DROP TABLE IF EXISTS "public"."jp_rental_additionals" CASCADE;
DROP TABLE IF EXISTS "public"."jp_tenants" CASCADE;
DROP TABLE IF EXISTS "public"."jp_signature_proposal_actions" CASCADE;
DROP TABLE IF EXISTS "public"."jp_signature_proposals" CASCADE;
DROP TABLE IF EXISTS "public"."jp_objective_items" CASCADE;
DROP TABLE IF EXISTS "public"."jp_objective_cards" CASCADE;
DROP SEQUENCE IF EXISTS "public"."jp_rental_receipt_seq" CASCADE;
